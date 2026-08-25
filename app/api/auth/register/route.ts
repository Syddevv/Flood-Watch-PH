import { errorResponse, successResponse } from "@/lib/api-response";
import { createAuthSession } from "@/lib/auth-session";
import { hashPassword, isValidPasswordLength } from "@/lib/password";
import { isPrismaUniqueConstraintError, prisma } from "@/lib/prisma";
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

    let user;
    try {
      user = await prisma.user.create({
        data: { email, passwordHash, displayName },
      });
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        return errorResponse("Unable to create an account with the provided details.", 409);
      }
      throw error;
    }

    const session = await createAuthSession(user.id);

    return successResponse(
      {
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
        },
      },
      {
        status: 201,
        headers: { "Set-Cookie": session.cookie },
      },
    );
  } catch (error) {
    logApiError("auth-register-failed", request, error);
    return errorResponse("Something went wrong while creating your account.");
  }
}
