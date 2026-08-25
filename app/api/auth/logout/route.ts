import { errorResponse, successResponse } from "@/lib/api-response";
import { destroySession } from "@/lib/auth-session";
import { protectApiRequest } from "@/lib/request-security";
import { logApiError } from "@/lib/structured-logger";

export async function POST(request: Request) {
  try {
    const protectionResponse = await protectApiRequest(request, {
      scope: "auth-logout",
      limit: 20,
      windowMs: 60 * 60 * 1000,
      requireTrustedOrigin: true,
    });

    if (protectionResponse) {
      return protectionResponse;
    }

    const session = await destroySession(request);

    return successResponse(
      { loggedOut: true },
      { headers: { "Set-Cookie": session.cookie } },
    );
  } catch (error) {
    logApiError("auth-logout-failed", request, error);
    return errorResponse("Something went wrong while signing you out.");
  }
}
