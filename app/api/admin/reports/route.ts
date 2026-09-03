import { errorResponse, successResponse } from "@/lib/api-response";
import { requireAdminApi } from "@/lib/admin-auth";
import { parseAdminReportFilters } from "@/lib/admin-reports";
import { deriveReportLifecycleStatus } from "@/lib/report-lifecycle";
import { prisma } from "@/lib/prisma";

const headers = { "Cache-Control": "no-store" };
const severityRank: Record<string, number> = { Critical: 4, High: 3, Moderate: 2, Low: 1 };

export async function GET(request: Request) {
  const auth = await requireAdminApi(request);
  if (auth.response) return auth.response;
  const params = new URL(request.url).searchParams;
  const parsed = parseAdminReportFilters(params);
  if (parsed.error || !parsed.filters) return errorResponse(parsed.error ?? "Invalid report filters.", 400);
  const filters = parsed.filters;
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(params.get("limit") ?? "20", 10) || 20));
  const reports = await prisma.floodReport.findMany({ where: { ...(filters.verificationStatus ? { verificationStatus: filters.verificationStatus } : {}), ...(filters.severity ? { severity: filters.severity } : {}), ...(filters.incidentId ? { incidentId: filters.incidentId } : {}), ...(filters.createdFrom || filters.createdTo ? { createdAt: { ...(filters.createdFrom ? { gte: new Date(filters.createdFrom) } : {}), ...(filters.createdTo ? { lte: new Date(filters.createdTo) } : {}) } } : {}), ...(filters.search ? { OR: [{ id: { contains: filters.search, mode: "insensitive" } }, { title: { contains: filters.search, mode: "insensitive" } }, { description: { contains: filters.search, mode: "insensitive" } }, { locationName: { contains: filters.search, mode: "insensitive" } }, { user: { email: { contains: filters.search, mode: "insensitive" } } }] } : {}) }, include: { incident: { select: { reportCount: true } }, user: { select: { id: true, email: true, displayName: true } } }, orderBy: { createdAt: "desc" } });
  const mapped = reports.map((r) => ({ id: r.id, title: r.title, locationName: r.locationName, latitude: r.latitude, longitude: r.longitude, category: r.category, severity: r.severity, publicStatus: deriveReportLifecycleStatus(r), verificationStatus: r.verificationStatus, incidentId: r.incidentId, incidentReportCount: r.incident.reportCount, hasPhoto: Boolean(r.imageUrl), reporter: r.user ? { id: r.user.id, email: r.user.email, displayName: r.user.displayName } : null, createdAt: r.createdAt.toISOString(), lastActivityAt: r.lastActivityAt.toISOString() }));
  const filtered = filters.publicStatus ? mapped.filter((r) => r.publicStatus === filters.publicStatus) : mapped;
  filtered.sort((a, b) => { const key = filters.sort; const av = key === "severity" ? severityRank[a.severity] : a[key]; const bv = key === "severity" ? severityRank[b.severity] : b[key]; const result = av < bv ? -1 : av > bv ? 1 : 0; return filters.order === "asc" ? result : -result; });
  const total = filtered.length;
  const items = filtered.slice((page - 1) * limit, page * limit);
  const [activeCount, needsReviewCount, highSeverityCount, photoCount, activeIncidentCount] = await Promise.all([
    prisma.floodReport.count({ where: { status: { in: ["Needs More Confirmation", "Confirmed by Community"] } } }),
    prisma.floodReport.count({ where: { verificationStatus: "unreviewed" } }),
    prisma.floodReport.count({ where: { severity: { in: ["High", "Critical"] } } }),
    prisma.floodReport.count({ where: { imageUrl: { not: null } } }),
    prisma.incident.count({ where: { status: { in: ["Needs More Confirmation", "Confirmed by Community"] } } }),
  ]);
  return successResponse({ reports: items, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }, summary: { activeCount, needsReviewCount, highSeverityCount, photoCount, activeIncidentCount } }, { headers });
}
