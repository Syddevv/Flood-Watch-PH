import assert from "node:assert/strict";
import test from "node:test";

import {
  EMAIL_VERIFICATION_MAX_ATTEMPTS,
  canUserAuthenticate,
  generateEmailVerificationCode,
  getEmailVerificationKeys,
  getEmailVerificationState,
  hashEmailVerificationCode,
  verifyEmailVerificationCode,
} from "@/lib/email-verification-token";

const CURRENT_SECRET = "current-email-verification-secret-32-characters";
const PREVIOUS_SECRET = "previous-email-verification-secret-32-characters";

test("verification codes are cryptographically generated six-digit values", () => {
  const codes = new Set(
    Array.from({ length: 50 }, () => generateEmailVerificationCode(0, {})),
  );
  assert.equal([...codes].every((code) => /^\d{6}$/.test(code)), true);
  assert.ok(codes.size > 1);
});

test("deterministic codes are available only while using the explicit test database", () => {
  const base = {
    EMAIL_VERIFICATION_TEST_CODE: "123456",
    TEST_DATABASE_URL: "postgresql://test",
  };
  assert.equal(
    generateEmailVerificationCode(1, { ...base, DATABASE_URL: "postgresql://test" }),
    "123457",
  );
  assert.notEqual(
    generateEmailVerificationCode(1, { ...base, DATABASE_URL: "postgresql://production" }),
    "123457",
  );
});

test("HMAC verification supports a previous key during rotation", () => {
  const oldKeys = getEmailVerificationKeys({
    EMAIL_VERIFICATION_HMAC_KEY: PREVIOUS_SECRET,
  });
  const rotatedKeys = getEmailVerificationKeys({
    EMAIL_VERIFICATION_HMAC_KEY: CURRENT_SECRET,
    EMAIL_VERIFICATION_HMAC_KEY_PREVIOUS: PREVIOUS_SECRET,
  });
  const hash = hashEmailVerificationCode("user-1", "123456", oldKeys.current);

  assert.equal(
    verifyEmailVerificationCode("user-1", "123456", hash, oldKeys.current.id, rotatedKeys.all),
    true,
  );
  assert.equal(
    verifyEmailVerificationCode("user-1", "654321", hash, oldKeys.current.id, rotatedKeys.all),
    false,
  );
  assert.equal(hash.includes("123456"), false);
});

test("verification state enforces expiry, attempt exhaustion, and single use", () => {
  const now = Date.parse("2026-10-17T00:00:00.000Z");
  assert.equal(
    getEmailVerificationState(
      { consumedAt: null, expiresAt: new Date(now + 1), attemptCount: 0 },
      now,
    ),
    "active",
  );
  assert.equal(
    getEmailVerificationState(
      { consumedAt: null, expiresAt: new Date(now), attemptCount: 0 },
      now,
    ),
    "expired",
  );
  assert.equal(
    getEmailVerificationState(
      {
        consumedAt: null,
        expiresAt: new Date(now + 1),
        attemptCount: EMAIL_VERIFICATION_MAX_ATTEMPTS,
      },
      now,
    ),
    "exhausted",
  );
  assert.equal(
    getEmailVerificationState(
      { consumedAt: new Date(now), expiresAt: new Date(now + 1), attemptCount: 0 },
      now,
    ),
    "consumed",
  );
});

test("only verified and explicit legacy-grace accounts can authenticate", () => {
  assert.equal(canUserAuthenticate("verified"), true);
  assert.equal(canUserAuthenticate("legacy_grace", "2099-01-01T00:00:00.000Z"), true);
  assert.equal(
    canUserAuthenticate("legacy_admin_review", "2099-01-01T00:00:00.000Z"),
    true,
  );
  assert.equal(canUserAuthenticate("legacy_grace", "2020-01-01T00:00:00.000Z"), false);
  assert.equal(canUserAuthenticate("legacy_grace", undefined), false);
  assert.equal(canUserAuthenticate("pending"), false);
});
