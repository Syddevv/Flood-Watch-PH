import { adminSuccessResponse } from "@/lib/admin-api-response";
import { requireProtectedAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { rescueApiError } from "@/lib/rescue-api";

export async function GET(request: Request) {
  try {
    const auth = await requireProtectedAdminApi(request, { scope: "admin-rescue-operators", limit: 120, windowMs: 60_000 });
    if (auth.response) return auth.response;
    const operators = await prisma.user.findMany({ where: { role: "admin" }, orderBy: { email: "asc" }, select: { id: true, displayName: true, email: true } });
    return adminSuccessResponse(request, { operators });
  } catch (error) { return rescueApiError(request, error); }
}
