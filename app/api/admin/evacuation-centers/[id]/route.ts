import { adminErrorResponse, adminSuccessResponse } from "@/lib/admin-api-response";
import { requireProtectedAdminApi } from "@/lib/admin-auth";
import { parseCenterPayload } from "@/lib/admin-evacuation";
import { recordAdminAudit } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const auth = await requireProtectedAdminApi(request, { scope: "admin-center-detail", limit: 120, windowMs: 60_000 });
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const center = await prisma.evacuationCenter.findUnique({ where: { id } });
  return center ? adminSuccessResponse(request, { center }) : adminErrorResponse(request, "Evacuation center not found.", 404);
}

export async function PATCH(request: Request, context: Context) {
  const auth = await requireProtectedAdminApi(request, { scope: "admin-center-update", limit: 30, windowMs: 60_000 });
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const parsed = parseCenterPayload(await request.json().catch(() => null));
  if (parsed.error || !parsed.data) return adminErrorResponse(request, parsed.error ?? "Invalid evacuation-center data.", 400);
  const current = await prisma.evacuationCenter.findUnique({ where: { id } });
  if (!current) return adminErrorResponse(request, "Evacuation center not found.", 404);
  const center = await prisma.evacuationCenter.update({ where: { id }, data: { ...parsed.data, updatedByUserId: auth.user.id } });
  await recordAdminAudit({ actorUserId: auth.user.id, action: "ADMIN_EVACUATION_CENTER_UPDATED", targetType: "EvacuationCenter", targetId: id, requestId: request.headers.get("x-request-id") ?? undefined, metadata: { previous: JSON.parse(JSON.stringify(current)), next: JSON.parse(JSON.stringify(center)) } });
  return adminSuccessResponse(request, { center });
}
