import { adminSuccessResponse } from "@/lib/admin-api-response";
import { requireProtectedAdminApi } from "@/lib/admin-auth";
import { readRescueJson, rescueApiError } from "@/lib/rescue-api";
import { actOnRescueRequest } from "@/lib/rescue-service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireProtectedAdminApi(request, { scope: "admin-rescue-action", limit: 60, windowMs: 60_000 });
    if (auth.response) return auth.response;
    return adminSuccessResponse(request, await actOnRescueRequest((await params).id, auth.user.id, await readRescueJson(request)));
  } catch (error) { return rescueApiError(request, error); }
}
