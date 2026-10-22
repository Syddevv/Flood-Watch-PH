import { errorResponse, successResponse } from "@/lib/api-response";
import { getAuthenticatedUserFromRequest } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { normalizeFullName } from "@/lib/registration-policy";
import { protectApiRequest } from "@/lib/request-security";
import { logApiError } from "@/lib/structured-logger";

export async function PATCH(request: Request) {
  const protection = await protectApiRequest(request, {
    scope: "auth-profile-update", limit: 10, windowMs: 60 * 60 * 1000, requireTrustedOrigin: true,
  });
  if (protection) return protection;
  const user = await getAuthenticatedUserFromRequest(request);
  if (!user) return errorResponse("Sign in to update your profile.", 401);
  const payload = await request.json().catch(() => null) as { fullName?: unknown } | null;
  const fullName = normalizeFullName(payload?.fullName);
  if (!fullName) return errorResponse("Enter your full name with at least two name components.", 400);
  try {
    await prisma.user.update({ where: { id: user.id }, data: { fullName, displayName: fullName } });
    return successResponse({ fullName });
  } catch (error) {
    logApiError("auth-profile-update-failed", request, error);
    return errorResponse("Unable to update your profile right now. Please try again.", 503);
  }
}
