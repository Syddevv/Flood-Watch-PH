import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTH_SESSION_COOKIE_NAME,
  generateSessionToken,
  hashSessionToken,
} from "@/lib/auth-session-token";

test("generates a well-formed, unique token on each call", () => {
  const first = generateSessionToken();
  const second = generateSessionToken();

  assert.ok(/^[A-Za-z0-9_-]{43}$/.test(first));
  assert.notEqual(first, second);
});

test("hashing the same token twice produces the same digest", () => {
  const token = generateSessionToken();
  assert.equal(hashSessionToken(token), hashSessionToken(token));
});

test("hashing different tokens produces different digests", () => {
  const first = generateSessionToken();
  const second = generateSessionToken();
  assert.notEqual(hashSessionToken(first), hashSessionToken(second));
});

test("the raw token is never present in its own hash", () => {
  const token = generateSessionToken();
  assert.equal(hashSessionToken(token).includes(token), false);
});

test("cookie name is distinct from the anonymous report-session cookie", () => {
  assert.equal(AUTH_SESSION_COOKIE_NAME, "floodwatch_auth_session");
});
