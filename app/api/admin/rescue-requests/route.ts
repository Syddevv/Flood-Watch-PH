import { adminSuccessResponse } from "@/lib/admin-api-response";
import { requireProtectedAdminApi } from "@/lib/admin-auth";
import { readRescueJson, rescueApiError } from "@/lib/rescue-api";
import { createRescueRequest, listRescueRequests } from "@/lib/rescue-service";

export async function GET(request: Request) {
  try {
    const auth = await requireProtectedAdminApi(request, { scope: "admin-rescue-list", limit: 120, windowMs: 60_000 });
    if (auth.response) return auth.response;
    return adminSuccessResponse(request, await listRescueRequests(auth.user.id, new URL(request.url).searchParams, true));
  } catch (error) { return rescueApiError(request, error); }
}

export async function POST(request: Request) {
  try {
    const auth = await requireProtectedAdminApi(request, { scope: "admin-rescue-create", limit: 30, windowMs: 60_000 });
    if (auth.response) return auth.response;
    const result = await createRescueRequest(auth.user.id, await readRescueJson(request), request.headers.get("idempotency-key"), true);
    return adminSuccessResponse(request, result, { status: result.replayed ? 200 : 201 });
  } catch (error) { return rescueApiError(request, error); }
}
