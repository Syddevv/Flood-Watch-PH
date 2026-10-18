import { adminErrorResponse, adminSuccessResponse } from "@/lib/admin-api-response";
import { getAuthenticatedUserFromRequest } from "@/lib/auth-session";
import { protectApiRequest } from "@/lib/request-security";
import { readRescueJson, rescueApiError } from "@/lib/rescue-api";
import { correctRescueRequest, getRescueRequest } from "@/lib/rescue-service";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) return adminErrorResponse(request, "Authentication required.", 401);
    const protection = await protectApiRequest(request, { scope: "rescue-detail", limit: 120, windowMs: 60_000, databaseFailureFallback: "fail-closed" });
    if (protection) return protection;
    return adminSuccessResponse(request, await getRescueRequest((await params).id, user.id));
  } catch (error) { return rescueApiError(request, error); }
}

export async function PATCH(request: Request, { params }: Context) {
  try {
    const protection = await protectApiRequest(request, { scope: "rescue-correct", limit: 20, windowMs: 60_000, requireTrustedOrigin: true, databaseFailureFallback: "fail-closed" });
    if (protection) return protection;
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) return adminErrorResponse(request, "Authentication required.", 401);
    return adminSuccessResponse(request, await correctRescueRequest((await params).id, user.id, await readRescueJson(request)));
  } catch (error) { return rescueApiError(request, error); }
}
