import { errorResponse, successResponse } from "@/lib/api-response";
import { requireAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { deriveReportLifecycleStatus } from "@/lib/report-lifecycle";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi(request);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const report = await prisma.floodReport.findUnique({ where: { id }, include: { user: { select: { id: true, email: true, displayName: true } }, incident: { include: { reports: { select: { id: true, title: true, severity: true, status: true, locationName: true, createdAt: true } } } }, updates: { orderBy: { createdAt: "desc" } }, confirmations: { orderBy: { createdAt: "desc" } } } });
  if (!report) return errorResponse("Report not found.", 404);
  return successResponse({ report: { ...report, publicStatus: deriveReportLifecycleStatus(report), createdAt: report.createdAt.toISOString(), updatedAt: report.updatedAt.toISOString(), lastActivityAt: report.lastActivityAt.toISOString(), photoCapturedAt: report.photoCapturedAt?.toISOString() ?? null, resolvedAt: report.resolvedAt?.toISOString() ?? null, archivedAt: report.archivedAt?.toISOString() ?? null } }, { headers: { "Cache-Control": "no-store" } });
}
