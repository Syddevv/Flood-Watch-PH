import { errorResponse, successResponse } from "@/lib/api-response";
import { requireAdminApi } from "@/lib/admin-auth";
import { recordAdminAudit } from "@/lib/admin-audit";
import { isAdminVerificationStatus } from "@/lib/admin-reports";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi(request);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { verificationStatus?: unknown } | null;
  const next = typeof body?.verificationStatus === "string" ? body.verificationStatus : "";
  if (!isAdminVerificationStatus(next)) return errorResponse("Invalid verification status.", 400);
  const current = await prisma.floodReport.findUnique({ where: { id }, select: { verificationStatus: true, incidentId: true } });
  if (!current) return errorResponse("Report not found.", 404);
  const report = await prisma.floodReport.update({ where: { id }, data: { verificationStatus: next } });
  await recordAdminAudit({ actorUserId: auth.user.id, action: "ADMIN_REPORT_VERIFICATION_CHANGED", targetType: "FloodReport", targetId: id, requestId: request.headers.get("x-request-id") ?? undefined, metadata: { previous: current.verificationStatus, next, incidentId: current.incidentId } });
  return successResponse({ id: report.id, verificationStatus: report.verificationStatus }, { headers: { "Cache-Control": "no-store" } });
}
