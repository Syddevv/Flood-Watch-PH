import { adminErrorResponse, adminSuccessResponse } from "@/lib/admin-api-response";
import { requireProtectedAdminApi } from "@/lib/admin-auth";
import { parseCenterPayload } from "@/lib/admin-evacuation";
import { recordAdminAudit } from "@/lib/admin-audit";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const auth = await requireProtectedAdminApi(request, { scope: "admin-centers-read", limit: 120, windowMs: 60_000 });
  if (auth.response) return auth.response;
  const params = new URL(request.url).searchParams;
  const search = params.get("search")?.trim() ?? "";
  const archived = params.get("archived") === "true";
  const centers = await prisma.evacuationCenter.findMany({
    where: { isArchived: archived, ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { address: { contains: search, mode: "insensitive" } }, { city: { contains: search, mode: "insensitive" } }, { province: { contains: search, mode: "insensitive" } }] } : {}) },
    orderBy: { updatedAt: "desc" },
  });
  return adminSuccessResponse(request, { centers });
}

export async function POST(request: Request) {
  const auth = await requireProtectedAdminApi(request, { scope: "admin-centers-write", limit: 30, windowMs: 60_000 });
  if (auth.response) return auth.response;
  const parsed = parseCenterPayload(await request.json().catch(() => null));
  if (parsed.error || !parsed.data) return adminErrorResponse(request, parsed.error ?? "Invalid evacuation-center data.", 400);
  const center = await prisma.evacuationCenter.create({ data: { ...parsed.data, updatedByUserId: auth.user.id } });
  await recordAdminAudit({ actorUserId: auth.user.id, action: "ADMIN_EVACUATION_CENTER_CREATED", targetType: "EvacuationCenter", targetId: center.id, requestId: request.headers.get("x-request-id") ?? undefined });
  return adminSuccessResponse(request, { center }, { status: 201 });
}
