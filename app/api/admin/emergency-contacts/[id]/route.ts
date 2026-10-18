import { adminErrorResponse, adminSuccessResponse } from "@/lib/admin-api-response";
import { recordAdminAudit } from "@/lib/admin-audit";
import { requireProtectedAdminApi } from "@/lib/admin-auth";
import { parseAdminContactPayload } from "@/lib/admin-emergency-contact";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const auth = await requireProtectedAdminApi(request, { scope: "admin-contact-detail", limit: 120, windowMs: 60_000 });
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const contact = await prisma.emergencyContact.findUnique({ where: { id } });
  return contact ? adminSuccessResponse(request, { contact }) : adminErrorResponse(request, "Contact not found.", 404);
}

export async function PATCH(request: Request, context: Context) {
  const auth = await requireProtectedAdminApi(request, { scope: "admin-contact-update", limit: 30, windowMs: 60_000 });
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = parseAdminContactPayload(body);
  if (parsed.error || !parsed.data) return adminErrorResponse(request, parsed.error ?? "Invalid contact data.", 400);
  const expectedUpdatedAt = body && typeof body === "object" && typeof body.expectedUpdatedAt === "string" ? new Date(body.expectedUpdatedAt) : null;
  if (!expectedUpdatedAt || Number.isNaN(expectedUpdatedAt.getTime())) return adminErrorResponse(request, "Current record version is required.", 400);
  const current = await prisma.emergencyContact.findUnique({ where: { id } });
  if (!current) return adminErrorResponse(request, "Contact not found.", 404);
  if (current.updatedAt.getTime() !== expectedUpdatedAt.getTime()) return adminErrorResponse(request, "This contact changed. Refresh before saving.", 409);
  const updated = await prisma.emergencyContact.updateMany({ where: { id, updatedAt: expectedUpdatedAt }, data: {
    ...parsed.data, updatedByUserId: auth.user.id,
  } });
  if (updated.count !== 1) return adminErrorResponse(request, "This contact changed. Refresh before saving.", 409);
  const contact = await prisma.emergencyContact.findUniqueOrThrow({ where: { id } });
  await recordAdminAudit({ actorUserId: auth.user.id, action: "ADMIN_EMERGENCY_CONTACT_UPDATED", targetType: "EmergencyContact", targetId: id, requestId: request.headers.get("x-request-id") ?? undefined,
    metadata: { previous: JSON.parse(JSON.stringify(current)), next: JSON.parse(JSON.stringify(contact)) } });
  return adminSuccessResponse(request, { contact });
}
