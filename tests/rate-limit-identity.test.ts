import assert from "node:assert/strict";
import test from "node:test";

import { getRateLimitIdentity } from "@/lib/rate-limit-identity";

test("signed session identity takes precedence over proxy headers", () => {
  const request = new Request("https://example.com/api", {
    headers: { "x-forwarded-for": "203.0.113.10" },
  });

  assert.equal(
    getRateLimitIdentity(request, "signed-session-hash", "x-forwarded-for"),
    "session:signed-session-hash",
  );
});

test("client-supplied address headers are ignored unless explicitly trusted", () => {
  const request = new Request("https://example.com/api", {
    headers: {
      "cf-connecting-ip": "203.0.113.10",
      "x-real-ip": "203.0.113.11",
      "x-forwarded-for": "203.0.113.12",
    },
  });

  assert.equal(getRateLimitIdentity(request, ""), "anonymous");
});

test("only the configured proxy header supplies an address identity", () => {
  const request = new Request("https://example.com/api", {
    headers: {
      "cf-connecting-ip": "203.0.113.10",
      "x-forwarded-for": "203.0.113.12, 10.0.0.1",
    },
  });

  assert.equal(
    getRateLimitIdentity(request, "", "x-forwarded-for"),
    "address:203.0.113.12",
  );
  assert.equal(
    getRateLimitIdentity(request, "", "cf-connecting-ip"),
    "address:203.0.113.10",
  );
});

test("unsupported or malformed proxy settings fall back to anonymous identity", () => {
  const request = new Request("https://example.com/api", {
    headers: { "x-custom-client-ip": "203.0.113.10" },
  });

  assert.equal(
    getRateLimitIdentity(request, "", "x-custom-client-ip"),
    "anonymous",
  );
});
