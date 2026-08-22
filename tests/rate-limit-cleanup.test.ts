import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("rate-limit cleanup uses a bounded, lock-safe deletion strategy", () => {
  const source = readFileSync("lib/request-security.ts", "utf8");

  assert.match(source, /LIMIT \$\{RATE_LIMIT_CLEANUP_BATCH_SIZE\}/);
  assert.match(source, /FOR UPDATE SKIP LOCKED/);
  assert.match(source, /RATE_LIMIT_CLEANUP_INTERVAL_MS/);
  assert.match(source, /Failed to clean up expired API rate-limit records/);
});
