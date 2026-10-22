import { adminSuccessResponse } from "@/lib/admin-api-response";
import { requireProtectedAdminApi } from "@/lib/admin-auth";
import { EMERGENCY_CONTACT_CATEGORIES } from "@/lib/emergency-contact-categories";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const auth = await requireProtectedAdminApi(request, { scope: "admin-contacts-read", limit: 120, windowMs: 60_000 });
  if (auth.response) return auth.response;
  const params = new URL(request.url).searchParams;
  const page = Math.max(1, Math.min(10000, Number.parseInt(params.get("page") ?? "1", 10) || 1));
  const search = params.get("search")?.trim().slice(0, 100) ?? "";
  const city = params.get("city")?.trim() ?? "";
  const requestedCategory = params.get("category")?.trim() ?? "";
  const category = EMERGENCY_CONTACT_CATEGORIES.find((value) => value === requestedCategory);
  const archived = params.get("archived") === "true";
  const where = { isArchived: archived,
    ...(city ? { city } : {}),
    ...(category ? { category } : {}),
    ...(search ? { OR: [
      { agencyName: { contains: search, mode: "insensitive" as const } },
      { contactNumber: { contains: search, mode: "insensitive" as const } },
    ] } : {}),
  };
  const [contacts, total] = await prisma.$transaction([
    prisma.emergencyContact.findMany({ where, orderBy: [{ preferred: "desc" }, { city: "asc" }, { agencyName: "asc" }], skip: (page - 1) * 24, take: 24 }),
    prisma.emergencyContact.count({ where }),
  ]);
  return adminSuccessResponse(request, { contacts, total, page, pageSize: 24 });
}
