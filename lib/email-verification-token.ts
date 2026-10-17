import {
  createHash,
  createHmac,
  randomInt,
  timingSafeEqual,
} from "node:crypto";

import { ConfigurationError } from "@/lib/configuration-error";

export const EMAIL_VERIFICATION_CODE_LIFETIME_MS = 10 * 60 * 1000;
export const EMAIL_VERIFICATION_MAX_ATTEMPTS = 5;
export const EMAIL_VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;
export const EMAIL_VERIFICATION_SECRET_MIN_LENGTH = 32;

type EnvLike = Record<string, string | undefined>;

export type EmailVerificationKey = {
  id: string;
  secret: string;
};

function keyIdForSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex").slice(0, 16);
}

function readKey(name: string, env: EnvLike) {
  const secret = env[name]?.trim();
  if (!secret) return null;

  if (secret.length < EMAIL_VERIFICATION_SECRET_MIN_LENGTH) {
    throw new ConfigurationError(
      `${name} must contain at least ${EMAIL_VERIFICATION_SECRET_MIN_LENGTH} characters.`,
    );
  }

  return { id: keyIdForSecret(secret), secret } satisfies EmailVerificationKey;
}

export function getEmailVerificationKeys(env: EnvLike = process.env) {
  const current = readKey("EMAIL_VERIFICATION_HMAC_KEY", env);
  if (!current) {
    throw new ConfigurationError("EMAIL_VERIFICATION_HMAC_KEY must be configured.");
  }

  const previous = readKey("EMAIL_VERIFICATION_HMAC_KEY_PREVIOUS", env);
  return {
    current,
    all: previous && previous.id !== current.id ? [current, previous] : [current],
  };
}

function getConfiguredTestCode(sequence: number, env: EnvLike) {
  const configured = env.EMAIL_VERIFICATION_TEST_CODE;
  const testDatabaseUrl = env.TEST_DATABASE_URL;

  if (
    !configured ||
    !/^\d{6}$/.test(configured) ||
    !testDatabaseUrl ||
    env.DATABASE_URL !== testDatabaseUrl
  ) {
    return null;
  }

  return String((Number(configured) + sequence) % 1_000_000).padStart(6, "0");
}

export function generateEmailVerificationCode(
  sequence = 0,
  env: EnvLike = process.env,
) {
  return getConfiguredTestCode(sequence, env) ?? String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function isEmailVerificationCode(value: unknown): value is string {
  return typeof value === "string" && /^\d{6}$/.test(value);
}

export function hashEmailVerificationCode(
  userId: string,
  code: string,
  key: EmailVerificationKey,
) {
  return createHmac("sha256", key.secret)
    .update(`floodwatch-email-verification:v1:${userId}:${code}`)
    .digest("hex");
}

export function verifyEmailVerificationCode(
  userId: string,
  code: string,
  storedHash: string,
  storedKeyId: string,
  keys: EmailVerificationKey[],
) {
  const key = keys.find((candidate) => candidate.id === storedKeyId);
  if (!key || !/^[a-f0-9]{64}$/.test(storedHash)) return false;

  const actual = Buffer.from(hashEmailVerificationCode(userId, code, key), "hex");
  const expected = Buffer.from(storedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function canUserAuthenticate(
  emailVerificationStatus: string,
  legacyGraceDeadline = process.env.LEGACY_EMAIL_GRACE_DEADLINE,
  now = Date.now(),
) {
  if (emailVerificationStatus === "verified") return true;
  if (
    emailVerificationStatus !== "legacy_grace" &&
    emailVerificationStatus !== "legacy_admin_review"
  ) {
    return false;
  }

  const deadline = legacyGraceDeadline ? Date.parse(legacyGraceDeadline) : Number.NaN;
  return Number.isFinite(deadline) && deadline > now;
}

export function getEmailVerificationState(
  verification: {
    consumedAt: Date | null;
    expiresAt: Date;
    attemptCount: number;
  },
  now = Date.now(),
) {
  if (verification.consumedAt) return "consumed" as const;
  if (verification.expiresAt.getTime() <= now) return "expired" as const;
  if (verification.attemptCount >= EMAIL_VERIFICATION_MAX_ATTEMPTS) {
    return "exhausted" as const;
  }
  return "active" as const;
}
