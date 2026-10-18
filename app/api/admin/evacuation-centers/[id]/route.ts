import { adminErrorResponse, adminSuccessResponse } from "@/lib/admin-api-response";
import { requireProtectedAdminApi } from "@/lib/admin-auth";
import { parseCenterPayload, parseOperationalConfirmation } from "@/lib/admin-evacuation";
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
  const body = await request.json().catch(() => null);
  const parsed = parseCenterPayload(body);
  if (parsed.error || !parsed.data) return adminErrorResponse(request, parsed.error ?? "Invalid evacuation-center data.", 400);
  const expectedUpdatedAt = body && typeof body === "object" && typeof body.expectedUpdatedAt === "string" ? new Date(body.expectedUpdatedAt) : null;
  if (!expectedUpdatedAt || Number.isNaN(expectedUpdatedAt.getTime())) return adminErrorResponse(request, "Current record version is required.", 400);
  const current = await prisma.evacuationCenter.findUnique({ where: { id } });
  if (!current) return adminErrorResponse(request, "Evacuation center not found.", 404);
  if (current.updatedAt.getTime() !== expectedUpdatedAt.getTime()) return adminErrorResponse(request, "This center changed. Refresh before saving.", 409);
  const confirmation = parseOperationalConfirmation(body, parsed.data.status, current.status);
  if (confirmation.error) return adminErrorResponse(request, confirmation.error, 400);
  const availabilityConfirmedAt = confirmation.confirmedAt ?? (parsed.data.status === current.status ? current.availabilityConfirmedAt : null);
  const updated = await prisma.evacuationCenter.updateMany({
    where: { id, updatedAt: expectedUpdatedAt },
    data: { ...parsed.data, adminEvidenceUrl: parsed.data.adminEvidenceUrl ?? confirmation.evidenceUrl ?? null, availabilityConfirmedAt, updatedByUserId: auth.user.id },
  });
  if (updated.count !== 1) return adminErrorResponse(request, "This center changed. Refresh before saving.", 409);
  const center = await prisma.evacuationCenter.findUniqueOrThrow({ where: { id } });
  await recordAdminAudit({ actorUserId: auth.user.id, action: "ADMIN_EVACUATION_CENTER_UPDATED", targetType: "EvacuationCenter", targetId: id, requestId: request.headers.get("x-request-id") ?? undefined, metadata: { previous: JSON.parse(JSON.stringify(current)), next: JSON.parse(JSON.stringify(center)), operationalConfirmation: confirmation.confirmedAt ? { at: confirmation.confirmedAt.toISOString(), evidenceUrl: confirmation.evidenceUrl, directNote: confirmation.directNote } : null } });
  return adminSuccessResponse(request, { center });
}
