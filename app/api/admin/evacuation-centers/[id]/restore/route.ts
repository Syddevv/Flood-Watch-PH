import { adminErrorResponse, adminSuccessResponse } from "@/lib/admin-api-response";
import { requireProtectedAdminApi } from "@/lib/admin-auth";
import { recordAdminAudit } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireProtectedAdminApi(request, { scope: "admin-center-restore", limit: 20, windowMs: 60_000 });
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const center = await prisma.evacuationCenter.findUnique({ where: { id } });
  if (!center) return adminErrorResponse(request, "Evacuation center not found.", 404);
  if (!center.isArchived) return adminSuccessResponse(request, { center });
  const restored = await prisma.evacuationCenter.update({ where: { id }, data: { isArchived: false, archivedAt: null, archivedByUserId: null, updatedByUserId: auth.user.id } });
  await recordAdminAudit({ actorUserId: auth.user.id, action: "ADMIN_EVACUATION_CENTER_RESTORED", targetType: "EvacuationCenter", targetId: id, requestId: request.headers.get("x-request-id") ?? undefined });
  return adminSuccessResponse(request, { center: restored });
}
