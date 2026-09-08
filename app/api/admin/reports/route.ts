import { adminErrorResponse, adminSuccessResponse } from "@/lib/admin-api-response";
import { parseAdminPagination } from "@/lib/admin-contracts";
import { requireProtectedAdminApi } from "@/lib/admin-auth";
import { parseAdminReportFilters } from "@/lib/admin-reports";
import { toAdminReportDto } from "@/lib/admin-report-dto";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function GET(request: Request) {
  const auth = await requireProtectedAdminApi(request, { scope: "admin-reports-read", limit: 120, windowMs: 60_000 });
  if (auth.response) return auth.response;
  const params = new URL(request.url).searchParams;
  const parsed = parseAdminReportFilters(params);
  if (parsed.error || !parsed.filters) return adminErrorResponse(request, parsed.error ?? "Invalid report filters.", 400);
  const filters = parsed.filters;
  const { page, limit } = parseAdminPagination(params);
  const where = {
    ...(filters.verificationStatus ? { verificationStatus: filters.verificationStatus } : {}),
    ...(filters.severity ? { severity: filters.severity } : {}),
    ...(filters.incidentId ? { incidentId: filters.incidentId } : {}),
    ...(filters.createdFrom || filters.createdTo ? { createdAt: { ...(filters.createdFrom ? { gte: new Date(filters.createdFrom) } : {}), ...(filters.createdTo ? { lte: new Date(filters.createdTo) } : {}) } } : {}),
    ...(filters.search ? { OR: [{ id: { contains: filters.search, mode: "insensitive" as const } }, { title: { contains: filters.search, mode: "insensitive" as const } }, { description: { contains: filters.search, mode: "insensitive" as const } }, { locationName: { contains: filters.search, mode: "insensitive" as const } }, { user: { email: { contains: filters.search, mode: "insensitive" as const } } }] } : {}),
    ...(filters.publicStatus === "archived" ? { archivedAt: { not: null } } : filters.publicStatus === "resolved" ? { status: "Resolved" } : filters.publicStatus === "active" ? { status: { in: ["Needs More Confirmation", "Confirmed by Community"] } } : {}),
  };
  const orderBy = (filters.sort === "severity" ? { severity: filters.order } : { [filters.sort]: filters.order }) as Prisma.FloodReportOrderByWithRelationInput;
  const [reports, total] = await Promise.all([
    prisma.floodReport.findMany({ where, include: { incident: { select: { reportCount: true } }, user: { select: { id: true, email: true, displayName: true } } }, orderBy: [orderBy, { id: filters.order as Prisma.SortOrder }], skip: (page - 1) * limit, take: limit }),
    prisma.floodReport.count({ where }),
  ]);
  const [activeCount, needsReviewCount, highSeverityCount, photoCount, activeIncidentCount] = await Promise.all([
    prisma.floodReport.count({ where: { status: { in: ["Needs More Confirmation", "Confirmed by Community"] } } }),
    prisma.floodReport.count({ where: { verificationStatus: "unreviewed" } }),
    prisma.floodReport.count({ where: { severity: { in: ["High", "Critical"] } } }),
    prisma.floodReport.count({ where: { imageUrl: { not: null } } }),
    prisma.incident.count({ where: { status: { in: ["Needs More Confirmation", "Confirmed by Community"] } } }),
  ]);
  return adminSuccessResponse(request, { reports: reports.map(toAdminReportDto), pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }, summary: { activeCount, needsReviewCount, highSeverityCount, photoCount, activeIncidentCount } });
}
