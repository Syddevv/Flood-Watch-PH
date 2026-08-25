import { createHash, randomBytes } from "node:crypto";

export const AUTH_SESSION_COOKIE_NAME = "floodwatch_auth_session";
export const AUTH_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function generateSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
