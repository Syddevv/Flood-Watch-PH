import assert from "node:assert/strict";
import test from "node:test";

import { consumeInMemoryRateLimit } from "@/lib/in-memory-rate-limit";

test("in-memory limiter allows up to the configured limit", () => {
  const first = consumeInMemoryRateLimit("test-limit-1", 2, 60_000, 1_000);
  const second = consumeInMemoryRateLimit("test-limit-1", 2, 60_000, 1_001);
  const third = consumeInMemoryRateLimit("test-limit-1", 2, 60_000, 1_002);

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(third.allowed, false);
});

test("in-memory limiter resets after the window expires", () => {
  const first = consumeInMemoryRateLimit("test-limit-2", 1, 100, 2_000);
  const second = consumeInMemoryRateLimit("test-limit-2", 1, 100, 2_101);

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
});
