import { adminSuccessResponse } from "@/lib/admin-api-response";
import { requireProtectedAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { createResponderOrganization, listResponderOrganizations } from "@/lib/rescue-dispatch-data";
import { readRescueJson, rescueApiError } from "@/lib/rescue-api";

export async function GET(request: Request) {
  try {
    const auth = await requireProtectedAdminApi(request, { scope: "admin-responders-list", limit: 120, windowMs: 60_000 });
    if (auth.response) return auth.response;
    return adminSuccessResponse(request, { organizations: await listResponderOrganizations(prisma, auth.user.id, new URL(request.url).searchParams) });
  } catch (error) { return rescueApiError(request, error); }
}

export async function POST(request: Request) {
  try {
    const auth = await requireProtectedAdminApi(request, { scope: "admin-responders-create", limit: 30, windowMs: 60_000 });
    if (auth.response) return auth.response;
    return adminSuccessResponse(request, await createResponderOrganization(prisma, auth.user.id, await readRescueJson(request)), { status: 201 });
  } catch (error) { return rescueApiError(request, error); }
}
