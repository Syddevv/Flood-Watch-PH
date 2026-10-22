import { adminErrorResponse, adminSuccessResponse } from "@/lib/admin-api-response";
import { requireProtectedAdminApi } from "@/lib/admin-auth";
import { ADMIN_SETTINGS_KEYS, parseAdminSettings } from "@/lib/admin-settings-config";
import { getAdminSettingsSnapshot } from "@/lib/admin-settings-store";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const auth = await requireProtectedAdminApi(request, { scope: "admin-settings-read", limit: 60, windowMs: 60_000 });
  if (auth.response) return auth.response;
  try { return adminSuccessResponse(request, await getAdminSettingsSnapshot()); }
  catch { return adminErrorResponse(request, "Settings are temporarily unavailable.", 503); }
}

export async function PUT(request: Request) {
  const auth = await requireProtectedAdminApi(request, { scope: "admin-settings-write", limit: 20, windowMs: 60_000 });
  if (auth.response) return auth.response;
  if (!request.headers.get("content-type")?.startsWith("application/json") || Number(request.headers.get("content-length") || 0) > 4096)
    return adminErrorResponse(request, "Invalid settings request.", 400);
  const raw = await request.text().catch(() => "");
  if (raw.length > 4096) return adminErrorResponse(request, "Invalid settings request.", 400);
  let body: unknown = null;
  try { body = JSON.parse(raw) as unknown; } catch { /* Invalid JSON is rejected below. */ }
  if (!body || typeof body !== "object" || Array.isArray(body)) return adminErrorResponse(request, "Choose valid values for every setting.", 400);
  const payload = body as Record<string, unknown>;
  const values = parseAdminSettings(payload.values);
  if (!values || typeof payload.version !== "string" || !/^[a-f0-9]{64}$/.test(payload.version)) return adminErrorResponse(request, "Choose valid values for every setting.", 400);
  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('floodwatch:admin-settings')::bigint)`;
      const snapshot = await getAdminSettingsSnapshot(tx);
      if (snapshot.version !== payload.version) return null;
      const previous = snapshot.values;
      for (const key of ADMIN_SETTINGS_KEYS) {
        if (previous[key] === values[key]) continue;
        await tx.adminSetting.upsert({ where: { key }, create: { key, value: JSON.stringify(values[key]), updatedByUserId: auth.user.id }, update: { value: JSON.stringify(values[key]), updatedByUserId: auth.user.id } });
      }
      if (ADMIN_SETTINGS_KEYS.some((key) => previous[key] !== values[key]))
        await tx.adminAuditLog.create({ data: { actorUserId: auth.user.id, action: "ADMIN_SETTINGS_UPDATED", targetType: "AdminSetting", targetId: "administration", requestId: request.headers.get("x-request-id"), metadata: { previous, next: values } } });
      return getAdminSettingsSnapshot(tx);
    });
    return result ? adminSuccessResponse(request, result) : adminErrorResponse(request, "Settings changed in another session. Reload before saving.", 409);
  } catch { return adminErrorResponse(request, "Could not save settings. Try again.", 503); }
}
