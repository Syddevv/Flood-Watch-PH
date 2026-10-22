import { adminErrorResponse, adminSuccessResponse } from "@/lib/admin-api-response";
import { requireProtectedAdminApi } from "@/lib/admin-auth";
import { parseCenterPayload, parseOperationalConfirmation } from "@/lib/admin-evacuation";
import { prisma } from "@/lib/prisma";
import { createAdminNotifications, getAdminSettings } from "@/lib/admin-settings-store";

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
  const result = await prisma.$transaction(async (tx) => {
    const nameKey = `${parsed.data.localityCode}:${parsed.data.name.toLocaleLowerCase("en-PH")}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${nameKey})::bigint)`;
    const current = await tx.evacuationCenter.findUnique({ where: { id } });
    if (!current) return { error: "Evacuation center not found.", status: 404 } as const;
    if (current.updatedAt.getTime() !== expectedUpdatedAt.getTime()) return { error: "This center changed. Refresh before saving.", status: 409 } as const;
    const duplicate = await tx.evacuationCenter.findFirst({ where: {
      id: { not: id }, city: parsed.data.city,
      name: { equals: parsed.data.name, mode: "insensitive" },
    }, select: { id: true } });
    if (duplicate) return { error: "A center with this name already exists in this locality. Review the existing record.", status: 409 } as const;
    const confirmation = parseOperationalConfirmation(body, parsed.data.status, current.status);
    if (confirmation.error) return { error: confirmation.error, status: 400 } as const;
    const availabilityConfirmedAt = confirmation.confirmedAt ?? (parsed.data.status === current.status ? current.availabilityConfirmedAt : null);
    const updated = await tx.evacuationCenter.updateMany({
      where: { id, updatedAt: expectedUpdatedAt },
      data: { ...parsed.data, adminEvidenceUrl: parsed.data.adminEvidenceUrl ?? confirmation.evidenceUrl ?? null, availabilityConfirmedAt, updatedByUserId: auth.user.id },
    });
    if (updated.count !== 1) return { error: "This center changed. Refresh before saving.", status: 409 } as const;
    const center = await tx.evacuationCenter.findUniqueOrThrow({ where: { id } });
    await tx.adminAuditLog.create({ data: { actorUserId: auth.user.id, action: "ADMIN_EVACUATION_CENTER_UPDATED", targetType: "EvacuationCenter", targetId: id, requestId: request.headers.get("x-request-id"), metadata: { previous: JSON.parse(JSON.stringify(current)), next: JSON.parse(JSON.stringify(center)), operationalConfirmation: confirmation.confirmedAt ? { at: confirmation.confirmedAt.toISOString(), evidenceUrl: confirmation.evidenceUrl, directNote: confirmation.directNote } : null } } });
    if ((await getAdminSettings(tx)).centerUpdateAlerts) await createAdminNotifications(tx, {
      type: "evacuation_center_updated", title: "Evacuation center updated",
      detail: `${center.name} · ${center.city} · Status: ${center.status} · Verification: ${center.verificationStatus}`,
      targetType: "EvacuationCenter", targetId: id, dedupeKey: `center-update:${id}:${center.updatedAt.toISOString()}`,
    });
    return { center } as const;
  });
  if (result.error) return adminErrorResponse(request, result.error, result.status);
  return adminSuccessResponse(request, { center: result.center });
}
