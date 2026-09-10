import { adminErrorResponse, adminSuccessResponse } from "@/lib/admin-api-response";
import { requireProtectedAdminApi } from "@/lib/admin-auth";
import { recordAdminAudit } from "@/lib/admin-audit";
import { recordAdminOperationalAction } from "@/lib/admin-action-service";
import { prisma } from "@/lib/prisma";

const MAX_NOTE_LENGTH = 2000;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireProtectedAdminApi(request, { scope: "admin-report-notes", limit: 30, windowMs: 60_000 });
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { note?: unknown; visibility?: unknown } | null;
  const note = typeof body?.note === "string" ? body.note.trim() : "";
  const visibility = body?.visibility === "public" ? "public" : body?.visibility === "internal" || body?.visibility === undefined ? "internal" : null;
  if (!note || note.length > MAX_NOTE_LENGTH) return adminErrorResponse(request, `Note must be between 1 and ${MAX_NOTE_LENGTH} characters.`, 400);
  if (!visibility) return adminErrorResponse(request, "Invalid note visibility.", 400);
  const report = await prisma.floodReport.findUnique({ where: { id }, select: { id: true } });
  if (!report) return adminErrorResponse(request, "Report not found.", 404);
  const requestId = request.headers.get("x-request-id");
  const action = await prisma.$transaction((tx) => recordAdminOperationalAction(tx, { targetType: "FloodReport", targetId: id, actionType: "note", actorUserId: auth.user.id, visibility, note, requestId }));
  await recordAdminAudit({ actorUserId: auth.user.id, action: "ADMIN_REPORT_NOTE_ADDED", targetType: "FloodReport", targetId: id, requestId: requestId ?? undefined, metadata: { visibility } });
  return adminSuccessResponse(request, { action: { ...action, createdAt: action.createdAt.toISOString() } }, { status: 201 });
}
