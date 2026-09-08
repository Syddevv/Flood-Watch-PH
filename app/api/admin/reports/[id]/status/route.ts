import { adminErrorResponse, adminSuccessResponse } from "@/lib/admin-api-response";
import { requireProtectedAdminApi } from "@/lib/admin-auth";
import { ADMIN_TO_PUBLIC_REPORT_STATUS, canTransitionAdminReportStatus, isAdminReportStatus, parseExpectedUpdatedAt } from "@/lib/admin-contracts";
import { recordAdminAudit } from "@/lib/admin-audit";
import { recordAdminOperationalAction } from "@/lib/admin-action-service";
import { prisma } from "@/lib/prisma";

function currentAdminStatus(status: string | null, archivedAt: Date | null, resolvedAt: Date | null, latestActionStatus?: string | null) {
  if (latestActionStatus && isAdminReportStatus(latestActionStatus)) return latestActionStatus;
  if (archivedAt || status === "Archived") return "closed" as const;
  if (resolvedAt || status === "Resolved") return "resolved" as const;
  if (status === "Confirmed by Community") return "verified" as const;
  return "pending" as const;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireProtectedAdminApi(request, { scope: "admin-report-status", limit: 30, windowMs: 60_000 });
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { status?: unknown; expectedUpdatedAt?: unknown } | null;
  const next = typeof body?.status === "string" ? body.status : "";
  if (!isAdminReportStatus(next)) return adminErrorResponse(request, "Invalid report status.", 400);
  const current = await prisma.floodReport.findUnique({ where: { id }, select: { status: true, archivedAt: true, resolvedAt: true, updatedAt: true } });
  if (!current) return adminErrorResponse(request, "Report not found.", 404);
  const latestAction = await prisma.adminOperationalAction.findFirst({ where: { targetType: "FloodReport", targetId: id, actionType: { in: ["status_change", "resolution"] } }, orderBy: { createdAt: "desc" }, select: { nextValue: true } });
  const expected = parseExpectedUpdatedAt(typeof body?.expectedUpdatedAt === "string" ? body.expectedUpdatedAt : null);
  if (expected === null) return adminErrorResponse(request, "Invalid expectedUpdatedAt value.", 400);
  if (expected && current.updatedAt.getTime() !== expected.getTime()) return adminErrorResponse(request, "This report changed since it was loaded.", 409);
  const previous = currentAdminStatus(current.status, current.archivedAt, current.resolvedAt, latestAction?.nextValue);
  if (!canTransitionAdminReportStatus(previous, next)) return adminErrorResponse(request, `Cannot change report status from ${previous} to ${next}.`, 400);
  const now = new Date();
  const report = await prisma.$transaction(async (tx) => {
    const updated = await tx.floodReport.update({ where: { id }, data: { status: ADMIN_TO_PUBLIC_REPORT_STATUS[next], resolvedAt: next === "resolved" ? (current.resolvedAt ?? now) : next === "closed" ? current.resolvedAt : null, archivedAt: next === "closed" ? (current.archivedAt ?? now) : null, lastActivityAt: now } });
    await recordAdminOperationalAction(tx, { targetType: "FloodReport", targetId: id, actionType: next === "resolved" || next === "closed" ? "resolution" : "status_change", actorUserId: auth.user.id, previousValue: previous, nextValue: next, requestId: request.headers.get("x-request-id") });
    return updated;
  });
  await recordAdminAudit({ actorUserId: auth.user.id, action: "ADMIN_REPORT_STATUS_CHANGED", targetType: "FloodReport", targetId: id, requestId: request.headers.get("x-request-id") ?? undefined, metadata: { previous, next } });
  return adminSuccessResponse(request, { id: report.id, status: next, publicStatus: report.status, updatedAt: report.updatedAt.toISOString() });
}
