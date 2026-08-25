import { errorResponse, successResponse } from "@/lib/api-response";
import { getAuthenticatedUserFromRequest } from "@/lib/auth-session";
import { protectApiRequest } from "@/lib/request-security";
import { logApiError } from "@/lib/structured-logger";

export async function GET(request: Request) {
  try {
    const protectionResponse = await protectApiRequest(request, {
      scope: "auth-session-check",
      limit: 60,
      windowMs: 60 * 1000,
    });

    if (protectionResponse) {
      return protectionResponse;
    }

    const user = await getAuthenticatedUserFromRequest(request);

    return successResponse({ user });
  } catch (error) {
    logApiError("auth-session-check-failed", request, error);
    return errorResponse("Something went wrong while checking your session.");
  }
}
