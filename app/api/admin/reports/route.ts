import { adminErrorResponse, adminSuccessResponse } from "@/lib/admin-api-response";
import { parseAdminPagination } from "@/lib/admin-contracts";
import { requireAdminApi } from "@/lib/admin-auth";
import { parseAdminReportFilters } from "@/lib/admin-reports";
import { toAdminReportDto } from "@/lib/admin-report-dto";
import { prisma } from "@/lib/prisma";

const headers = { "Cache-Control": "no-store" };
const severityRank: Record<string, number> = { Critical: 4, High: 3, Moderate: 2, Low: 1 };

export async function GET(request: Request) {
  const auth = await requireAdminApi(request);
  if (auth.response) return auth.response;
  const params = new URL(request.url).searchParams;
  const parsed = parseAdminReportFilters(params);
  if (parsed.error || !parsed.filters) return adminErrorResponse(request, parsed.error ?? "Invalid report filters.", 400);
  const filters = parsed.filters;
  const { page, limit } = parseAdminPagination(params);
  const reports = await prisma.floodReport.findMany({ where: { ...(filters.verificationStatus ? { verificationStatus: filters.verificationStatus } : {}), ...(filters.severity ? { severity: filters.severity } : {}), ...(filters.incidentId ? { incidentId: filters.incidentId } : {}), ...(filters.createdFrom || filters.createdTo ? { createdAt: { ...(filters.createdFrom ? { gte: new Date(filters.createdFrom) } : {}), ...(filters.createdTo ? { lte: new Date(filters.createdTo) } : {}) } } : {}), ...(filters.search ? { OR: [{ id: { contains: filters.search, mode: "insensitive" } }, { title: { contains: filters.search, mode: "insensitive" } }, { description: { contains: filters.search, mode: "insensitive" } }, { locationName: { contains: filters.search, mode: "insensitive" } }, { user: { email: { contains: filters.search, mode: "insensitive" } } }] } : {}) }, include: { incident: { select: { reportCount: true } }, user: { select: { id: true, email: true, displayName: true } } }, orderBy: { createdAt: "desc" } });
  const mapped = reports.map((r) => toAdminReportDto(r));
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
  return adminSuccessResponse(request, { reports: items, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }, summary: { activeCount, needsReviewCount, highSeverityCount, photoCount, activeIncidentCount } }, { headers });
}
