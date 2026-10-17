import "server-only";

import { errorResponse, successResponse } from "@/lib/api-response";
import { requestVerificationEmail } from "@/lib/email-verification";
import { trimText } from "@/lib/report-api";
import { protectApiRequest } from "@/lib/request-security";
import { logApiError } from "@/lib/structured-logger";
import { isValidEmail } from "@/lib/validations";

export async function handleVerificationEmailRequest(request: Request) {
  try {
    const protectionResponse = await protectApiRequest(request, {
      scope: "auth-verification-request",
      limit: 10,
      windowMs: 15 * 60 * 1000,
      requireTrustedOrigin: true,
    });
    if (protectionResponse) return protectionResponse;

    const payload = (await request.json().catch(() => null)) as {
      email?: unknown;
    } | null;
    const email = trimText(payload?.email).toLowerCase();
    if (!email || !isValidEmail(email)) {
      return errorResponse("A valid email address is required.", 400);
    }

    const emailProtectionResponse = await protectApiRequest(request, {
      scope: "auth-verification-email",
      identity: `email:${email}`,
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });
    if (emailProtectionResponse) return emailProtectionResponse;

    await requestVerificationEmail(email);

    return successResponse(
      {
        requested: true,
        retryAfterSeconds: 60,
        message:
          "If this address has a pending account, a verification email will be sent.",
      },
      { status: 202 },
    );
  } catch (error) {
    logApiError("auth-verification-request-failed", request, error);
    return errorResponse("Unable to request a verification email right now.");
  }
}
