import { createAuthSession } from "@/lib/auth-session";
import { verifyPendingEmail } from "@/lib/email-verification";
import { isEmailVerificationCode } from "@/lib/email-verification-token";
import { trimText } from "@/lib/report-api";
import { protectApiRequest } from "@/lib/request-security";
import { logApiError } from "@/lib/structured-logger";
import { isValidEmail } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const protectionResponse = await protectApiRequest(request, {
      scope: "auth-verification-attempt",
      limit: 30,
      windowMs: 15 * 60 * 1000,
      requireTrustedOrigin: true,
    });
    if (protectionResponse) return protectionResponse;

    const payload = (await request.json().catch(() => null)) as {
      email?: unknown;
      code?: unknown;
    } | null;
    const email = trimText(payload?.email).toLowerCase();
    const code = typeof payload?.code === "string" ? payload.code.trim() : "";
    if (!email || !isValidEmail(email) || !isEmailVerificationCode(code)) {
      return Response.json(
        { error: "Enter a valid email and six-digit code.", code: "INVALID_INPUT" },
        { status: 400 },
      );
    }

    const emailProtectionResponse = await protectApiRequest(request, {
      scope: "auth-verification-attempt-email",
      identity: `email:${email}`,
      limit: 10,
      windowMs: 15 * 60 * 1000,
    });
    if (emailProtectionResponse) return emailProtectionResponse;

    const result = await verifyPendingEmail(email, code);
    if (result.outcome !== "verified") {
      const responseCode =
        result.outcome === "expired"
          ? "CODE_EXPIRED"
          : result.outcome === "exhausted"
            ? "CODE_EXHAUSTED"
            : "INVALID_CODE";
      return Response.json(
        {
          error:
            responseCode === "CODE_EXPIRED"
              ? "This code has expired. Request a new code."
              : responseCode === "CODE_EXHAUSTED"
                ? "Too many incorrect attempts. Request a new code."
                : "The verification code is invalid or has already been used.",
          code: responseCode,
        },
        { status: 400 },
      );
    }

    const session = await createAuthSession(result.user.id);
    return Response.json(
      {
        data: {
          verified: true,
          user: {
            id: result.user.id,
            email: result.user.email,
            displayName: result.user.displayName,
            role: result.user.role,
          },
        },
      },
      { headers: { "Set-Cookie": session.cookie } },
    );
  } catch (error) {
    logApiError("auth-verify-code-failed", request, error);
    return Response.json(
      { error: "Unable to verify your email right now." },
      { status: 500 },
    );
  }
}
