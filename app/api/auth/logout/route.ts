import { errorResponse, successResponse } from "@/lib/api-response";
import { destroySession, getAuthenticatedUserFromRequest } from "@/lib/auth-session";
import { recordAdminAudit } from "@/lib/admin-audit";
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

    const user = await getAuthenticatedUserFromRequest(request);
    const session = await destroySession(request);
    if (user?.role === "admin") {
      await recordAdminAudit({ actorUserId: user.id, action: "ADMIN_LOGOUT", targetType: "User", targetId: user.id, requestId: request.headers.get("x-request-id") ?? undefined }).catch((error) => {
        console.error("Failed to record administrator logout audit event.", error);
      });
    }

    return successResponse(
      { loggedOut: true },
      { headers: { "Set-Cookie": session.cookie } },
    );
  } catch (error) {
    logApiError("auth-logout-failed", request, error);
    return errorResponse("Something went wrong while signing you out.");
  }
}
