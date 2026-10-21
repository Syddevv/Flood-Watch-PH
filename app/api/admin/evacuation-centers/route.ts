import { adminErrorResponse, adminSuccessResponse } from "@/lib/admin-api-response";
import { requireProtectedAdminApi } from "@/lib/admin-auth";
import { parseCenterPayload, parseOperationalConfirmation } from "@/lib/admin-evacuation";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const auth = await requireProtectedAdminApi(request, { scope: "admin-centers-read", limit: 120, windowMs: 60_000 });
  if (auth.response) return auth.response;
  const params = new URL(request.url).searchParams;
  const search = params.get("search")?.trim().slice(0, 100) ?? "";
  const archived = params.get("archived") === "true";
  const city = params.get("city")?.trim() ?? "";
  const verificationStatus = params.get("verificationStatus")?.trim() ?? "";
  const page = Math.max(1, Math.min(10000, Number.parseInt(params.get("page") ?? "1", 10) || 1));
  const pageSize = 24;
  const where = {
    isArchived: archived,
    ...(city ? { city } : {}),
    ...(verificationStatus ? { verificationStatus } : {}),
    ...(search ? { OR: [
      { name: { contains: search, mode: "insensitive" as const } },
      { address: { contains: search, mode: "insensitive" as const } },
      { city: { contains: search, mode: "insensitive" as const } },
    ] } : {}),
  };
  const [centers, total] = await prisma.$transaction([
    prisma.evacuationCenter.findMany({ where, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], skip: (page - 1) * pageSize, take: pageSize }),
    prisma.evacuationCenter.count({ where }),
  ]);
  return adminSuccessResponse(request, { centers, total, page, pageSize });
}

export async function POST(request: Request) {
  const auth = await requireProtectedAdminApi(request, { scope: "admin-centers-write", limit: 30, windowMs: 60_000 });
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => null);
  const parsed = parseCenterPayload(body);
  if (parsed.error || !parsed.data) return adminErrorResponse(request, parsed.error ?? "Invalid evacuation-center data.", 400);
  const confirmation = parseOperationalConfirmation(body, parsed.data.status);
  if (confirmation.error) return adminErrorResponse(request, confirmation.error, 400);
  const result = await prisma.$transaction(async (tx) => {
    const nameKey = `${parsed.data.localityCode}:${parsed.data.name.toLocaleLowerCase("en-PH")}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${nameKey})::bigint)`;
    const duplicate = await tx.evacuationCenter.findFirst({ where: {
      name: { equals: parsed.data.name, mode: "insensitive" }, city: parsed.data.city,
    }, select: { id: true } });
    if (duplicate) return { error: "A center with this name already exists in this locality. Review the existing record.", status: 409 } as const;
    const center = await tx.evacuationCenter.create({ data: {
      ...parsed.data,
      adminEvidenceUrl: parsed.data.adminEvidenceUrl ?? confirmation.evidenceUrl ?? null,
      availabilityConfirmedAt: confirmation.confirmedAt ?? null,
      updatedByUserId: auth.user.id,
    } });
    await tx.adminAuditLog.create({ data: { actorUserId: auth.user.id, action: "ADMIN_EVACUATION_CENTER_CREATED", targetType: "EvacuationCenter", targetId: center.id, requestId: request.headers.get("x-request-id"), metadata: { operationalConfirmation: confirmation.confirmedAt ? { at: confirmation.confirmedAt.toISOString(), evidenceUrl: confirmation.evidenceUrl, directNote: confirmation.directNote } : null } } });
    return { center } as const;
  });
  if (result.error) return adminErrorResponse(request, result.error, result.status);
  return adminSuccessResponse(request, { center: result.center }, { status: 201 });
}
