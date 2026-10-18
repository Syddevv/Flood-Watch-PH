import { adminErrorResponse, adminSuccessResponse } from "@/lib/admin-api-response";
import { getAuthenticatedUserFromRequest } from "@/lib/auth-session";
import { protectApiRequest } from "@/lib/request-security";
import { readRescueJson, rescueApiError } from "@/lib/rescue-api";
import { createRescueRequest, listRescueRequests } from "@/lib/rescue-service";

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) return adminErrorResponse(request, "Authentication required.", 401);
    const protection = await protectApiRequest(request, { scope: "rescue-list", limit: 60, windowMs: 60_000, databaseFailureFallback: "fail-closed" });
    if (protection) return protection;
    return adminSuccessResponse(request, await listRescueRequests(user.id, new URL(request.url).searchParams));
  } catch (error) { return rescueApiError(request, error); }
}

export async function POST(request: Request) {
  try {
    const protection = await protectApiRequest(request, { scope: "rescue-create", limit: 12, windowMs: 60_000, requireTrustedOrigin: true, databaseFailureFallback: "fail-closed" });
    if (protection) return protection;
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) return adminErrorResponse(request, "Authentication required.", 401);
    const result = await createRescueRequest(user.id, await readRescueJson(request), request.headers.get("idempotency-key"));
    return adminSuccessResponse(request, result, { status: result.replayed ? 200 : 201 });
  } catch (error) { return rescueApiError(request, error); }
}
