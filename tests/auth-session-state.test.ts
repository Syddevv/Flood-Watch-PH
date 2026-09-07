import assert from "node:assert/strict";
import test from "node:test";

import { isAuthSessionCurrent } from "@/lib/auth-session-state";

test("missing or revoked sessions are not current", () => {
  assert.equal(isAuthSessionCurrent(null), false);
  assert.equal(isAuthSessionCurrent(undefined), false);
});

test("expired sessions are rejected and future sessions are accepted", () => {
  const now = Date.parse("2026-09-07T00:00:00.000Z");
  assert.equal(isAuthSessionCurrent({ expiresAt: new Date(now - 1) }, now), false);
  assert.equal(isAuthSessionCurrent({ expiresAt: new Date(now) }, now), false);
  assert.equal(isAuthSessionCurrent({ expiresAt: new Date(now + 1) }, now), true);
});
