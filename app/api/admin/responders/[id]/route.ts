import { adminSuccessResponse } from "@/lib/admin-api-response";
import { requireProtectedAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { getResponderOrganization, updateResponderOrganization } from "@/lib/rescue-dispatch-data";
import { readRescueJson, rescueApiError } from "@/lib/rescue-api";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  try {
    const auth = await requireProtectedAdminApi(request, { scope: "admin-responders-detail", limit: 120, windowMs: 60_000 });
    if (auth.response) return auth.response;
    return adminSuccessResponse(request, await getResponderOrganization(prisma, auth.user.id, (await params).id));
  } catch (error) { return rescueApiError(request, error); }
}

export async function PATCH(request: Request, { params }: Context) {
  try {
    const auth = await requireProtectedAdminApi(request, { scope: "admin-responders-update", limit: 60, windowMs: 60_000 });
    if (auth.response) return auth.response;
    return adminSuccessResponse(request, await updateResponderOrganization(prisma, auth.user.id, (await params).id, await readRescueJson(request)));
  } catch (error) { return rescueApiError(request, error); }
}
