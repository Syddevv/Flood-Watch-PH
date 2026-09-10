import { adminErrorResponse, adminSuccessResponse } from "@/lib/admin-api-response";
import { requireProtectedAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { deriveReportLifecycleStatus } from "@/lib/report-lifecycle";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireProtectedAdminApi(request, { scope: "admin-report-detail", limit: 120, windowMs: 60_000 });
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const report = await prisma.floodReport.findUnique({ where: { id }, include: { user: { select: { id: true, email: true, displayName: true } }, incident: { include: { reports: { select: { id: true, title: true, severity: true, status: true, locationName: true, createdAt: true } } } }, updates: { orderBy: { createdAt: "desc" } }, confirmations: { orderBy: { createdAt: "desc" } } } });
  if (!report) return adminErrorResponse(request, "Report not found.", 404);
  const actions = await prisma.adminOperationalAction.findMany({ where: { targetType: "FloodReport", targetId: id }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, actionType: true, previousValue: true, nextValue: true, visibility: true, note: true, actorUserId: true, createdAt: true } });
  const latestStatus = actions.find((action) => action.actionType === "status_change")?.nextValue;
  return adminSuccessResponse(request, { report: { ...report, adminStatus: latestStatus ?? (report.archivedAt ? "closed" : report.resolvedAt ? "resolved" : report.status === "Confirmed by Community" ? "verified" : "pending"), publicStatus: deriveReportLifecycleStatus(report), createdAt: report.createdAt.toISOString(), updatedAt: report.updatedAt.toISOString(), lastActivityAt: report.lastActivityAt.toISOString(), photoCapturedAt: report.photoCapturedAt?.toISOString() ?? null, resolvedAt: report.resolvedAt?.toISOString() ?? null, archivedAt: report.archivedAt?.toISOString() ?? null, actions: actions.map((action) => ({ ...action, createdAt: action.createdAt.toISOString() })) } });
}
