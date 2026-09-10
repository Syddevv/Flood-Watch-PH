import { adminErrorResponse, adminSuccessResponse } from "@/lib/admin-api-response";
import { requireProtectedAdminApi } from "@/lib/admin-auth";
import { recordAdminAudit } from "@/lib/admin-audit";
import { isAdminVerificationStatus } from "@/lib/admin-reports";
import { prisma } from "@/lib/prisma";
import { recordAdminOperationalAction } from "@/lib/admin-action-service";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireProtectedAdminApi(request, { scope: "admin-report-verification", limit: 30, windowMs: 60_000 });
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { verificationStatus?: unknown } | null;
  const next = typeof body?.verificationStatus === "string" ? body.verificationStatus : "";
  if (!isAdminVerificationStatus(next)) return adminErrorResponse(request, "Invalid verification status.", 400);
  const current = await prisma.floodReport.findUnique({ where: { id }, select: { verificationStatus: true, incidentId: true } });
  if (!current) return adminErrorResponse(request, "Report not found.", 404);
  const report = await prisma.$transaction(async (tx) => {
    const updated = await tx.floodReport.update({ where: { id }, data: { verificationStatus: next } });
    await recordAdminOperationalAction(tx, {
      targetType: "FloodReport",
      targetId: id,
      actionType: "verification",
      actorUserId: auth.user.id,
      previousValue: current.verificationStatus,
      nextValue: next,
      requestId: request.headers.get("x-request-id"),
    });
    return updated;
  });
  await recordAdminAudit({ actorUserId: auth.user.id, action: "ADMIN_REPORT_VERIFICATION_CHANGED", targetType: "FloodReport", targetId: id, requestId: request.headers.get("x-request-id") ?? undefined, metadata: { previous: current.verificationStatus, next, incidentId: current.incidentId } });
  return adminSuccessResponse(request, { id: report.id, verificationStatus: report.verificationStatus });
}
