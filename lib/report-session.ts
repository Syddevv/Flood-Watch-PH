import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { ConfigurationError } from "@/lib/configuration-error";
import { buildSessionCookie, getCookieValue } from "@/lib/cookies";

export const REPORT_SESSION_COOKIE_NAME = "floodwatch_report_session";
export const REPORT_ACTION_UNDO_WINDOW_MS = 30_000;

const REPORT_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function getReportSessionSecret() {
  const secret = process.env.REPORT_SESSION_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV !== "production") {
      return "floodwatch-local-development-report-session-secret";
    }

    throw new ConfigurationError("REPORT_SESSION_SECRET must be set in production.");
  }

  if (secret.length < 32) {
    throw new ConfigurationError("REPORT_SESSION_SECRET must be at least 32 characters.");
  }

  return secret;
}

function hashSessionId(sessionId: string) {
  return createHash("sha256").update(sessionId).digest("hex");
}

function signSessionPayload(sessionId: string, expiresAt: number) {
  return createHmac("sha256", getReportSessionSecret())
    .update(`${sessionId}.${expiresAt}`)
    .digest("base64url");
}

function verifySessionToken(token: string) {
  const [sessionId, expiresAtValue, signature, ...extraParts] = token.split(".");

  if (
    extraParts.length > 0 ||
    !sessionId ||
    !SESSION_ID_PATTERN.test(sessionId) ||
    !expiresAtValue ||
    !signature
  ) {
    return null;
  }

  const expiresAt = Number(expiresAtValue);

  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) {
    return null;
  }

  const expectedSignature = signSessionPayload(sessionId, expiresAt);
  const receivedSignature = Buffer.from(signature);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);

  if (
    receivedSignature.length !== expectedSignatureBuffer.length ||
    !timingSafeEqual(receivedSignature, expectedSignatureBuffer)
  ) {
    return null;
  }

  return hashSessionId(sessionId);
}

export function getReportSessionHashFromRequest(request: Request) {
  const token = getCookieValue(request, REPORT_SESSION_COOKIE_NAME);
  return token ? verifySessionToken(token) ?? "" : "";
}

export function createReportSession() {
  const sessionId = randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + REPORT_SESSION_MAX_AGE_SECONDS * 1000;
  const signature = signSessionPayload(sessionId, expiresAt);

  return {
    sessionHash: hashSessionId(sessionId),
    cookie: buildSessionCookie(
      REPORT_SESSION_COOKIE_NAME,
      `${sessionId}.${expiresAt}.${signature}`,
      REPORT_SESSION_MAX_AGE_SECONDS,
      process.env.NODE_ENV === "production",
    ),
  };
}
