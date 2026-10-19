import { adminErrorResponse, adminSuccessResponse } from "@/lib/admin-api-response";
import { requireProtectedAdminApi } from "@/lib/admin-auth";
import { recordAdminOperationalAction } from "@/lib/admin-action-service";
import { syncIncidentAggregate } from "@/lib/incident-sync";
import { prisma } from "@/lib/prisma";
import { parseReviewDecision } from "@/lib/report-review";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireProtectedAdminApi(request, { scope: "admin-report-verification", limit: 30, windowMs: 60_000 });
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const parsed = parseReviewDecision(await request.json().catch(() => null));
  if (!parsed.data) return adminErrorResponse(request, parsed.error, 400);
  const decision = parsed.data;
  const requestId = request.headers.get("x-request-id");
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.floodReport.findUnique({ where: { id }, select: { verificationStatus: true, reviewVersion: true, updatedAt: true, incidentId: true } });
    if (!current) return { error: "Report not found.", status: 404 } as const;
    if (current.reviewVersion !== decision.expectedReviewVersion || current.updatedAt.getTime() !== decision.expectedUpdatedAt.getTime()) return { error: "This report changed since it was loaded.", status: 409 } as const;
    if (current.verificationStatus === decision.verificationStatus) return { error: "This review state is already recorded.", status: 409 } as const;
    const now = new Date();
    const updated = await tx.floodReport.updateMany({ where: { id, reviewVersion: decision.expectedReviewVersion, updatedAt: decision.expectedUpdatedAt }, data: { verificationStatus: decision.verificationStatus, reviewVersion: { increment: 1 }, reviewedAt: now, reviewedByUserId: auth.user.id, reviewPublicMessage: decision.publicMessage } });
    if (updated.count !== 1) return { error: "This report changed since it was loaded.", status: 409 } as const;
    await recordAdminOperationalAction(tx, {
      targetType: "FloodReport",
      targetId: id,
      actionType: "verification",
      actorUserId: auth.user.id,
      previousValue: current.verificationStatus,
      nextValue: decision.verificationStatus,
      note: decision.reason,
      requestId,
    });
    if (decision.publicMessage) await recordAdminOperationalAction(tx, { targetType: "FloodReport", targetId: id, actionType: "review_feedback", actorUserId: auth.user.id, visibility: "public", note: decision.publicMessage, requestId });
    await tx.adminAuditLog.create({ data: { actorUserId: auth.user.id, action: "ADMIN_REPORT_VERIFICATION_CHANGED", targetType: "FloodReport", targetId: id, requestId, metadata: { previous: current.verificationStatus, next: decision.verificationStatus, incidentId: current.incidentId } } });
    await syncIncidentAggregate(tx, current.incidentId, now);
    const report = await tx.floodReport.findUniqueOrThrow({ where: { id }, select: { id: true, verificationStatus: true, reviewVersion: true, updatedAt: true, reviewedAt: true, reviewedByUserId: true } });
    return { data: report } as const;
  });
  if (result.error) return adminErrorResponse(request, result.error, result.status);
  return adminSuccessResponse(request, result.data);
}
