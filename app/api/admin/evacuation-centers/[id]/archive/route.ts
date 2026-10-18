import { adminErrorResponse, adminSuccessResponse } from "@/lib/admin-api-response";
import { requireProtectedAdminApi } from "@/lib/admin-auth";
import { recordAdminAudit } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireProtectedAdminApi(request, { scope: "admin-center-archive", limit: 20, windowMs: 60_000 });
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const center = await prisma.evacuationCenter.findUnique({ where: { id } });
  if (!center) return adminErrorResponse(request, "Evacuation center not found.", 404);
  if (center.isArchived) return adminSuccessResponse(request, { center });
  const body = await request.json().catch(() => null);
  const expectedUpdatedAt = body && typeof body.expectedUpdatedAt === "string" ? new Date(body.expectedUpdatedAt) : null;
  if (!expectedUpdatedAt || center.updatedAt.getTime() !== expectedUpdatedAt.getTime()) return adminErrorResponse(request, "This center changed. Refresh before archiving.", 409);
  const changed = await prisma.evacuationCenter.updateMany({ where: { id, updatedAt: expectedUpdatedAt, isArchived: false }, data: { isArchived: true, archivedAt: new Date(), archivedByUserId: auth.user.id, updatedByUserId: auth.user.id } });
  if (changed.count !== 1) return adminErrorResponse(request, "This center changed. Refresh before archiving.", 409);
  const archived = await prisma.evacuationCenter.findUniqueOrThrow({ where: { id } });
  await recordAdminAudit({ actorUserId: auth.user.id, action: "ADMIN_EVACUATION_CENTER_ARCHIVED", targetType: "EvacuationCenter", targetId: id, requestId: request.headers.get("x-request-id") ?? undefined });
  return adminSuccessResponse(request, { center: archived });
}
