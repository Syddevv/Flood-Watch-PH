import { errorResponse, successResponse } from "@/lib/api-response";
import { createPendingRegistration } from "@/lib/email-verification";
import { hashPassword } from "@/lib/password";
import { isPrismaUniqueConstraintError } from "@/lib/prisma";
import { isValidRegistrationPassword, normalizeFullName, registrationEmail } from "@/lib/registration-policy";
import { protectApiRequest } from "@/lib/request-security";
import { logApiError } from "@/lib/structured-logger";

type RegisterPayload = {
  email?: unknown;
  password?: unknown;
  fullName?: unknown;
  locationToken?: unknown;
  streetAddress?: unknown;
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

    const email = registrationEmail(payload.email);
    const password = payload.password;
    const fullName = normalizeFullName(payload.fullName);
    const locationToken = payload.locationToken;
    const streetAddress = typeof payload.streetAddress === "string" ? payload.streetAddress.trim().replace(/\s+/gu, " ") : null;

    if (!email) {
      return errorResponse("A valid email address is required.", 400);
    }

    if (!isValidRegistrationPassword(password)) {
      return errorResponse("Password must be 10–200 characters and include letters plus a number or symbol.", 400);
    }

    if (!fullName) return errorResponse("Enter your full name with at least two name components.", 400);
    if (typeof locationToken !== "string" || !/^[a-f0-9]{64}$/.test(locationToken)) return errorResponse("Detect and verify your current location before creating an account.", 400);
    if (streetAddress && (streetAddress.length > 120 || /[<>\r\n]/u.test(streetAddress))) return errorResponse("Street details must be 120 characters or fewer.", 400);

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
        fullName,
        locationToken,
        streetAddress: streetAddress || null,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "REGISTRATION_LOCATION_EXPIRED") {
        return errorResponse("Location verification expired or was already used. Detect your location again.", 409);
      }
      if (isPrismaUniqueConstraintError(error)) {
        return errorResponse(
          "This email is already registered. Log in or use a different email. If you still need to verify it, request a new code from the verification page.",
          409,
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
