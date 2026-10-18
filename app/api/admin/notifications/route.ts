import { adminSuccessResponse } from "@/lib/admin-api-response";
import { requireProtectedAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { readRescueJson, rescueApiError } from "@/lib/rescue-api";
import { RescueError } from "@/lib/rescue-contracts";

export async function GET(request: Request) {
  try {
    const auth = await requireProtectedAdminApi(request, { scope: "admin-notifications-list", limit: 120, windowMs: 60_000 });
    if (auth.response) return auth.response;
    const [notifications, unreadCount] = await Promise.all([
      prisma.adminNotification.findMany({ where: { recipientUserId: auth.user.id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50,
        select: { id: true, title: true, detail: true, type: true, targetType: true, targetId: true, priority: true, readAt: true, createdAt: true } }),
      prisma.adminNotification.count({ where: { recipientUserId: auth.user.id, readAt: null } }),
    ]);
    return adminSuccessResponse(request, { notifications, unreadCount });
  } catch (error) { return rescueApiError(request, error); }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireProtectedAdminApi(request, { scope: "admin-notifications-read", limit: 60, windowMs: 60_000 });
    if (auth.response) return auth.response;
    const body = await readRescueJson(request) as { id?: unknown; all?: unknown };
    if (!body || typeof body !== "object" || Array.isArray(body) ||
        (body.all !== true && (typeof body.id !== "string" || !/^[a-zA-Z0-9_-]{10,100}$/.test(body.id))) ||
        Object.keys(body).some((key) => !["id", "all"].includes(key))) throw new RescueError("Choose a notification to mark as read.", 400);
    await prisma.adminNotification.updateMany({ where: { recipientUserId: auth.user.id, readAt: null, ...(body.all === true ? {} : { id: body.id as string }) }, data: { readAt: new Date() } });
    return adminSuccessResponse(request, { unreadCount: await prisma.adminNotification.count({ where: { recipientUserId: auth.user.id, readAt: null } }) });
  } catch (error) { return rescueApiError(request, error); }
}
