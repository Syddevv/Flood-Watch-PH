import assert from "node:assert/strict";
import test from "node:test";
import { isTrustedOrigin } from "@/lib/trusted-origin";

const config = { production: true, configuredOrigin: "https://flood-watch-ph.vercel.app" };
const url = "https://flood-watch-ph.vercel.app/api/admin/operations";

test("production accepts same-origin reads without an Origin header", () => {
  assert.equal(isTrustedOrigin(new Request(url, { headers: { host: "flood-watch-ph.vercel.app", "sec-fetch-site": "same-origin" } }), config), true);
  assert.equal(isTrustedOrigin(new Request(url, { method: "HEAD" }), config), true);
});

test("production rejects originless mutations and explicit cross-site requests", () => {
  assert.equal(isTrustedOrigin(new Request(url, { method: "POST" }), config), false);
  assert.equal(isTrustedOrigin(new Request(url, { headers: { "sec-fetch-site": "cross-site" } }), config), false);
  assert.equal(isTrustedOrigin(new Request(url, { headers: { origin: "https://other.example", host: "flood-watch-ph.vercel.app" } }), config), false);
});

test("production accepts an exact configured origin for mutations", () => {
  assert.equal(isTrustedOrigin(new Request(url, { method: "POST", headers: { origin: "https://flood-watch-ph.vercel.app" } }), config), true);
});
