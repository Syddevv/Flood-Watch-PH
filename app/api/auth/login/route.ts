import { errorResponse, successResponse } from "@/lib/api-response";
import { createAuthSession } from "@/lib/auth-session";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { trimText } from "@/lib/report-api";
import { protectApiRequest } from "@/lib/request-security";
import { logApiError } from "@/lib/structured-logger";
import { recordAdminAudit } from "@/lib/admin-audit";

type LoginPayload = {
  email?: unknown;
  password?: unknown;
};

const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password.";

// A fixed, valid-format hash so a login attempt against a nonexistent email
// still runs a full scrypt derivation before failing - otherwise a
// nonexistent-email response would return measurably faster than a
// wrong-password response, leaking which emails are registered.
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash() {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword("floodwatch-dummy-comparison-password");
  }
  return dummyHashPromise;
}

export async function POST(request: Request) {
  try {
    const protectionResponse = await protectApiRequest(request, {
      scope: "auth-login",
      limit: 10,
      windowMs: 15 * 60 * 1000,
      requireTrustedOrigin: true,
    });

    if (protectionResponse) {
      return protectionResponse;
    }

    const payload = (await request.json().catch(() => null)) as LoginPayload | null;

    if (!payload) {
      return errorResponse("Invalid request body.", 400);
    }

    const email = trimText(payload.email).toLowerCase();
    const password = typeof payload.password === "string" ? payload.password : "";

    const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
    const passwordValid = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));

    if (!user || !passwordValid) {
      return errorResponse(INVALID_CREDENTIALS_MESSAGE, 401);
    }

    const session = await createAuthSession(user.id);
    if (user.role === "admin") {
      await recordAdminAudit({ actorUserId: user.id, action: "ADMIN_LOGIN", targetType: "User", targetId: user.id, requestId: request.headers.get("x-request-id") ?? undefined }).catch((error) => {
        console.error("Failed to record administrator login audit event.", error);
      });
    }

    return successResponse(
      {
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
        },
      },
      { headers: { "Set-Cookie": session.cookie } },
    );
  } catch (error) {
    logApiError("auth-login-failed", request, error);
    return errorResponse("Something went wrong while signing you in.");
  }
}
