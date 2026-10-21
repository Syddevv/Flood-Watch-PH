import { adminErrorResponse, adminSuccessResponse } from "@/lib/admin-api-response";
import { requireProtectedAdminApi } from "@/lib/admin-auth";
import { canTransitionAdminReportStatus, inferAdminReportStatus, isAdminReportStatus, parseExpectedUpdatedAt, publicStatusForOperationalAction } from "@/lib/admin-contracts";
import { recordAdminOperationalAction } from "@/lib/admin-action-service";
import { prisma } from "@/lib/prisma";
import { lockFloodReportForUpdate } from "@/lib/prisma";
import { syncIncidentAggregate } from "@/lib/incident-sync";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireProtectedAdminApi(request, { scope: "admin-report-status", limit: 30, windowMs: 60_000 });
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { status?: unknown; expectedUpdatedAt?: unknown } | null;
  const next = typeof body?.status === "string" ? body.status : "";
  if (!isAdminReportStatus(next)) return adminErrorResponse(request, "Invalid report status.", 400);
  if (next === "verified" || next === "rejected") return adminErrorResponse(request, "Use the verification decision control for review outcomes.", 400);
  const expected = parseExpectedUpdatedAt(typeof body?.expectedUpdatedAt === "string" ? body.expectedUpdatedAt : null);
  if (!expected) return adminErrorResponse(request, "Expected report update time is required.", 400);
  const result = await prisma.$transaction(async (tx) => {
    if (!await lockFloodReportForUpdate(tx, id)) return { error: "Report not found.", status: 404 } as const;
    const current = await tx.floodReport.findUniqueOrThrow({ where: { id }, select: { status: true, archivedAt: true, resolvedAt: true, updatedAt: true, confirmationCount: true, incidentId: true } });
    if (current.updatedAt.getTime() !== expected.getTime()) return { error: "This report changed since it was loaded.", status: 409 } as const;
    const latestAction = await tx.adminOperationalAction.findFirst({ where: { targetType: "FloodReport", targetId: id, actionType: { in: ["status_change", "resolution"] } }, orderBy: { createdAt: "desc" }, select: { nextValue: true } });
    const previous = inferAdminReportStatus(current, latestAction?.nextValue);
    if (previous === next) return { error: "This operational status is already recorded.", status: 409 } as const;
    if (!canTransitionAdminReportStatus(previous, next)) return { error: `Cannot change report status from ${previous} to ${next}.`, status: 400 } as const;
    const now = new Date();
    const publicStatus = publicStatusForOperationalAction(next, current.confirmationCount);
    const updated = await tx.floodReport.update({ where: { id }, data: { status: publicStatus, resolvedAt: next === "resolved" ? (current.resolvedAt ?? now) : next === "closed" ? current.resolvedAt : null, archivedAt: next === "closed" ? (current.archivedAt ?? now) : null, lastActivityAt: now } });
    await recordAdminOperationalAction(tx, { targetType: "FloodReport", targetId: id, actionType: next === "resolved" || next === "closed" ? "resolution" : "status_change", actorUserId: auth.user.id, previousValue: previous, nextValue: next, requestId: request.headers.get("x-request-id") });
    await tx.adminAuditLog.create({ data: { actorUserId: auth.user.id, action: "ADMIN_REPORT_STATUS_CHANGED", targetType: "FloodReport", targetId: id, requestId: request.headers.get("x-request-id"), metadata: { previous, next } } });
    await syncIncidentAggregate(tx, current.incidentId, now);
    return { data: { id: updated.id, status: next, publicStatus: updated.status, updatedAt: updated.updatedAt.toISOString() } } as const;
  });
  if (result.error) return adminErrorResponse(request, result.error, result.status);
  return adminSuccessResponse(request, result.data);
}
