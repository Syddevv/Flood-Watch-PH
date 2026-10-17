import { errorResponse, successResponse } from "@/lib/api-response";
import { createPendingRegistration } from "@/lib/email-verification";
import { hashPassword, isValidPasswordLength } from "@/lib/password";
import { isPrismaUniqueConstraintError } from "@/lib/prisma";
import { getOptionalText, trimText } from "@/lib/report-api";
import { protectApiRequest } from "@/lib/request-security";
import { logApiError } from "@/lib/structured-logger";
import { isValidEmail } from "@/lib/validations";

const MAX_DISPLAY_NAME_LENGTH = 80;

type RegisterPayload = {
  email?: unknown;
  password?: unknown;
  displayName?: unknown;
};

export async function POST(request: Request) {
  try {
    const protectionResponse = await protectApiRequest(request, {
      scope: "auth-register",
      limit: 5,
      windowMs: 60 * 60 * 1000,
      requireTrustedOrigin: true,
    });

    if (protectionResponse) {
      return protectionResponse;
    }

    const payload = (await request.json().catch(() => null)) as RegisterPayload | null;

    if (!payload) {
      return errorResponse("Invalid request body.", 400);
    }

    const email = trimText(payload.email).toLowerCase();
    const password = typeof payload.password === "string" ? payload.password : "";
    const displayName = getOptionalText(payload.displayName);

    if (!email || !isValidEmail(email)) {
      return errorResponse("A valid email address is required.", 400);
    }

    if (!isValidPasswordLength(password)) {
      return errorResponse("Password must be between 10 and 200 characters.", 400);
    }

    if (displayName && displayName.length > MAX_DISPLAY_NAME_LENGTH) {
      return errorResponse(
        `Display name must not exceed ${MAX_DISPLAY_NAME_LENGTH} characters.`,
        400,
      );
    }

    const passwordHash = await hashPassword(password);

    const emailProtectionResponse = await protectApiRequest(request, {
      scope: "auth-register-email",
      identity: `email:${email}`,
      limit: 3,
      windowMs: 60 * 60 * 1000,
    });
    if (emailProtectionResponse) {
      return emailProtectionResponse;
    }

    let registration;
    try {
      registration = await createPendingRegistration({
        email,
        passwordHash,
        displayName: displayName ?? null,
      });
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        return successResponse(
          {
            verificationRequired: true,
            email,
            message:
              "If this address can be registered, verification instructions are available.",
          },
          { status: 202 },
        );
      }
      throw error;
    }

    if (!registration.delivered) {
      return Response.json(
        {
          error:
            "Your account is pending, but the verification email could not be sent. Try resending it shortly.",
          code: "VERIFICATION_DELIVERY_FAILED",
          email,
        },
        { status: 503 },
      );
    }

    return successResponse(
      {
        verificationRequired: true,
        email,
        message: "Check your email for a six-digit verification code.",
      },
      { status: 202 },
    );
  } catch (error) {
    logApiError("auth-register-failed", request, error);
    return errorResponse("Something went wrong while creating your account.");
  }
}
