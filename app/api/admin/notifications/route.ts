import { adminErrorResponse, adminSuccessResponse } from "@/lib/admin-api-response";
import { requireProtectedAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { getAdminSettings } from "@/lib/admin-settings-store";
import type { Prisma } from "@prisma/client";

// Keep historical notices in the database, but omit retired rescue notices from active views and counts.
const activeNotice: Prisma.AdminNotificationWhereInput = {
  AND: [
    { OR: [{ targetType: null }, { targetType: { not: "RescueRequest" } }] },
    { NOT: { type: { startsWith: "rescue_" } } },
  ],
};

async function readNotificationBody(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16_384) return null;
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(new TextDecoder().decode(Buffer.concat(chunks))) as unknown; }
  catch { return null; }
}

export async function GET(request: Request) {
  const auth = await requireProtectedAdminApi(request, { scope: "admin-notifications-list", limit: 120, windowMs: 60_000 });
  if (auth.response) return auth.response;
  try {
    const settings = await getAdminSettings();
    if (settings.pendingReportReminders) {
      const pending = await prisma.floodReport.findMany({
        where: { archivedAt: null, status: { in: ["Needs More Confirmation", "Confirmed by Community"] }, verificationStatus: "unreviewed", createdAt: { lte: new Date(Date.now() - settings.reminderMinutes * 60_000) } },
        orderBy: { createdAt: "asc" }, take: 30,
        select: { id: true, title: true, locationName: true, createdAt: true },
      });
      if (pending.length) await prisma.adminNotification.createMany({
        data: pending.map((report) => ({ type: "pending_report_reminder", title: "Report still awaiting review",
          detail: `${report.title} · ${report.locationName} · Submitted ${report.createdAt.toISOString()}`,
          targetType: "FloodReport", targetId: report.id, recipientUserId: auth.user.id,
          dedupeKey: `pending:${report.id}`, priority: "normal" })),
        skipDuplicates: true,
      });
    }
    const [notifications, unreadCount] = await Promise.all([
      prisma.adminNotification.findMany({ where: { recipientUserId: auth.user.id, ...activeNotice }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50,
        select: { id: true, title: true, detail: true, type: true, targetType: true, targetId: true, priority: true, readAt: true, createdAt: true } }),
      prisma.adminNotification.count({ where: { recipientUserId: auth.user.id, readAt: null, ...activeNotice } }),
    ]);
    return adminSuccessResponse(request, { notifications, unreadCount });
  } catch (error) {
    console.error("Admin notifications failed", error instanceof Error ? error.name : "unknown");
    return adminErrorResponse(request, "Notifications are temporarily unavailable.", 503);
  }
}

export async function PATCH(request: Request) {
  const auth = await requireProtectedAdminApi(request, { scope: "admin-notifications-read", limit: 60, windowMs: 60_000 });
  if (auth.response) return auth.response;
  const body = await readNotificationBody(request) as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      ("all" in body ? body.all !== true : !("id" in body) || typeof body.id !== "string" || !/^[a-zA-Z0-9_-]{10,100}$/.test(body.id)) ||
      Object.keys(body).some((key) => !["id", "all"].includes(key))) return adminErrorResponse(request, "Choose a notification to mark as read.", 400);
  try {
    await prisma.adminNotification.updateMany({ where: { recipientUserId: auth.user.id, readAt: null, ...activeNotice, ...("all" in body ? {} : { id: body.id as string }) }, data: { readAt: new Date() } });
    return adminSuccessResponse(request, { unreadCount: await prisma.adminNotification.count({ where: { recipientUserId: auth.user.id, readAt: null, ...activeNotice } }) });
  } catch (error) {
    console.error("Admin notification update failed", error instanceof Error ? error.name : "unknown");
    return adminErrorResponse(request, "Notifications are temporarily unavailable.", 503);
  }
}
