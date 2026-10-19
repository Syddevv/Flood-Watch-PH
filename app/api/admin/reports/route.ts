import { adminErrorResponse, adminSuccessResponse } from "@/lib/admin-api-response";
import { parseAdminPagination } from "@/lib/admin-contracts";
import { requireProtectedAdminApi } from "@/lib/admin-auth";
import { parseAdminReportFilters } from "@/lib/admin-reports";
import { toAdminReportDto } from "@/lib/admin-report-dto";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { isValidReportCategory, isValidReportSeverity } from "@/lib/validations";
import { OUTSIDE_BULACAN_ERROR_MESSAGE, isWithinBulacan } from "@/lib/bulacan-scope";
import { recordAdminAudit } from "@/lib/admin-audit";
import { recordAdminOperationalAction } from "@/lib/admin-action-service";
import { BULACAN_LOCALITIES } from "@/data/bulacan-localities";
import { REPORT_SEVERITIES } from "@/lib/constants";

export async function GET(request: Request) {
  const auth = await requireProtectedAdminApi(request, { scope: "admin-reports-read", limit: 120, windowMs: 60_000 });
  if (auth.response) return auth.response;
  const params = new URL(request.url).searchParams;
  const parsed = parseAdminReportFilters(params);
  if (parsed.error || !parsed.filters) return adminErrorResponse(request, parsed.error ?? "Invalid report filters.", 400);
  const filters = parsed.filters;
  const locality = BULACAN_LOCALITIES.find((entry) => entry.code === filters.localityCode);
  const { page, limit } = parseAdminPagination(params);
  const where = {
    ...(filters.verificationStatus ? { verificationStatus: filters.verificationStatus } : {}),
    ...(filters.severity ? { severity: filters.severity } : {}),
    ...(locality ? { locationName: { contains: locality.name.replace(/^City of /, ""), mode: "insensitive" as const } } : {}),
    ...(filters.incidentId ? { incidentId: filters.incidentId } : {}),
    ...(filters.createdFrom || filters.createdTo ? { createdAt: { ...(filters.createdFrom ? { gte: new Date(filters.createdFrom) } : {}), ...(filters.createdTo ? { lte: new Date(filters.createdTo) } : {}) } } : {}),
    ...(filters.search ? { OR: [{ id: { contains: filters.search, mode: "insensitive" as const } }, { title: { contains: filters.search, mode: "insensitive" as const } }, { description: { contains: filters.search, mode: "insensitive" as const } }, { locationName: { contains: filters.search, mode: "insensitive" as const } }, { user: { email: { contains: filters.search, mode: "insensitive" as const } } }] } : {}),
    ...(filters.publicStatus === "archived" ? { archivedAt: { not: null } } : filters.publicStatus === "resolved" ? { status: "Resolved" } : filters.publicStatus === "active" ? { status: { in: ["Needs More Confirmation", "Confirmed by Community"] } } : {}),
  };
  const include = { incident: { select: { reportCount: true } }, user: { select: { id: true, email: true, displayName: true } } } as const;
  let reports;
  let total;
  if (filters.sort === "severity") {
    // Severity is stored as text, whose lexical order differs from its domain order.
    const matches = await prisma.floodReport.findMany({ where, select: { id: true, severity: true } });
    const rank = (severity: string) => REPORT_SEVERITIES.indexOf(severity as typeof REPORT_SEVERITIES[number]);
    matches.sort((left, right) => (rank(left.severity) - rank(right.severity)) * (filters.order === "asc" ? 1 : -1) || left.id.localeCompare(right.id));
    total = matches.length;
    const pageIds = matches.slice((page - 1) * limit, page * limit).map((report) => report.id);
    const pageOrder = new Map(pageIds.map((id, index) => [id, index]));
    reports = (await prisma.floodReport.findMany({ where: { id: { in: pageIds } }, include })).sort((left, right) => pageOrder.get(left.id)! - pageOrder.get(right.id)!);
  } else {
    const orderBy = { [filters.sort]: filters.order } as Prisma.FloodReportOrderByWithRelationInput;
    [reports, total] = await Promise.all([
      prisma.floodReport.findMany({ where, include, orderBy: [orderBy, { id: filters.order as Prisma.SortOrder }], skip: (page - 1) * limit, take: limit }),
      prisma.floodReport.count({ where }),
    ]);
  }
  const [activeCount, needsReviewCount, highSeverityCount, photoCount, activeIncidentCount] = await Promise.all([
    prisma.floodReport.count({ where: { status: { in: ["Needs More Confirmation", "Confirmed by Community"] }, verificationStatus: { not: "rejected" } } }),
    prisma.floodReport.count({ where: { verificationStatus: "unreviewed" } }),
    prisma.floodReport.count({ where: { severity: { in: ["High", "Critical"] }, verificationStatus: { not: "rejected" } } }),
    prisma.floodReport.count({ where: { imageUrl: { not: null } } }),
    prisma.incident.count({ where: { status: { in: ["Needs More Confirmation", "Confirmed by Community"] } } }),
  ]);
  return adminSuccessResponse(request, { reports: reports.map(toAdminReportDto), pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }, summary: { activeCount, needsReviewCount, highSeverityCount, photoCount, activeIncidentCount } });
}

export async function POST(request: Request) {
  const auth = await requireProtectedAdminApi(request, { scope: "admin-report-create", limit: 20, windowMs: 60_000 });
  if (auth.response) return auth.response;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const text = (key: string, max: number) => typeof body?.[key] === "string" ? String(body[key]).trim().slice(0, max) : "";
  const title = text("title", 160), description = text("description", 5000), category = text("category", 80), severity = text("severity", 40), locationName = text("locationName", 240), reporterName = text("reporterName", 160);
  const latitude = Number(body?.latitude), longitude = Number(body?.longitude);
  if (!title || !description || !locationName || !isValidReportCategory(category) || !isValidReportSeverity(severity) || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return adminErrorResponse(request, "Invalid report details or coordinates.", 400);
  if (!isWithinBulacan(latitude, longitude)) return adminErrorResponse(request, OUTSIDE_BULACAN_ERROR_MESSAGE, 400);
  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const incident = await tx.incident.create({ data: { status: "Needs More Confirmation", representativeLatitude: latitude, representativeLongitude: longitude, locationName, severity, reportCount: 1, firstReportAt: now, lastActivityAt: now } });
    const report = await tx.floodReport.create({ data: { title, description, category, severity, locationName, latitude, longitude, locationSource: "admin", reportedByName: reporterName || null, sourceType: "Official", lastActivityAt: now, incidentId: incident.id } });
    await recordAdminOperationalAction(tx, { targetType: "FloodReport", targetId: report.id, actionType: "status_change", actorUserId: auth.user.id, previousValue: null, nextValue: "pending", note: "Created by administrator", requestId: request.headers.get("x-request-id") });
    return report;
  });
  await recordAdminAudit({ actorUserId: auth.user.id, action: "ADMIN_REPORT_CREATED", targetType: "FloodReport", targetId: result.id, requestId: request.headers.get("x-request-id") ?? undefined });
  return adminSuccessResponse(request, { id: result.id, incidentId: result.incidentId }, { status: 201 });
}
