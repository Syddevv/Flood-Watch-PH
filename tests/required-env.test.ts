import assert from "node:assert/strict";
import test from "node:test";

import { ConfigurationError, isConfigurationError } from "@/lib/configuration-error";
import {
  MIN_SECRET_LENGTH,
  findRequiredEnvIssues,
  formatRequiredEnvIssues,
  shouldFailOnEnvIssues,
} from "@/lib/required-env";

const VALID_SECRET = "x".repeat(MIN_SECRET_LENGTH);

function completeEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    DATABASE_URL: "postgresql://user:pass@host:5432/db",
    REPORT_SESSION_SECRET: VALID_SECRET,
    ABUSE_PROTECTION_SECRET: VALID_SECRET,
    NEXT_PUBLIC_APP_URL: "https://example.com",
    CLOUDINARY_CLOUD_NAME: "demo",
    CLOUDINARY_API_KEY: "key",
    CLOUDINARY_API_SECRET: "secret",
    ...overrides,
  };
}

test("a fully configured environment reports no issues", () => {
  assert.deepEqual(findRequiredEnvIssues(completeEnv()), []);
});

test("a missing report session secret is an error, not a warning", () => {
  // This is the exact production failure it exists to catch: without it every
  // rate-limited route fails at the protection layer.
  const issues = findRequiredEnvIssues(
    completeEnv({ REPORT_SESSION_SECRET: undefined, ABUSE_PROTECTION_SECRET: undefined }),
  );
  const secretIssue = issues.find((issue) => issue.name === "REPORT_SESSION_SECRET");

  assert.ok(secretIssue);
  assert.equal(secretIssue.severity, "error");
  assert.equal(secretIssue.problem, "missing");
});

test("a short secret is rejected as firmly as a missing one", () => {
  const issues = findRequiredEnvIssues(
    completeEnv({ REPORT_SESSION_SECRET: "too-short" }),
  );
  const secretIssue = issues.find((issue) => issue.name === "REPORT_SESSION_SECRET");

  assert.ok(secretIssue);
  assert.equal(secretIssue.problem, "too-short");
  assert.equal(secretIssue.severity, "error");
});

test("a missing database url is an error", () => {
  const issues = findRequiredEnvIssues(completeEnv({ DATABASE_URL: undefined }));

  assert.equal(issues.some((i) => i.name === "DATABASE_URL" && i.severity === "error"), true);
});

test("whitespace-only values count as missing", () => {
  const issues = findRequiredEnvIssues(completeEnv({ DATABASE_URL: "   " }));

  assert.equal(issues.some((i) => i.name === "DATABASE_URL" && i.problem === "missing"), true);
});

test("the abuse protection secret is satisfied by the report session secret", () => {
  const issues = findRequiredEnvIssues(
    completeEnv({ ABUSE_PROTECTION_SECRET: undefined }),
  );

  assert.equal(issues.some((issue) => issue.name === "ABUSE_PROTECTION_SECRET"), false);
});

test("missing Cloudinary credentials only warn, since other features still work", () => {
  const issues = findRequiredEnvIssues(completeEnv({ CLOUDINARY_API_KEY: undefined }));
  const cloudinaryIssue = issues.find((issue) => issue.name === "CLOUDINARY_API_KEY");

  assert.ok(cloudinaryIssue);
  assert.equal(cloudinaryIssue.severity, "warning");
});

test("the report names the variable and explains the consequence", () => {
  const issues = findRequiredEnvIssues(
    completeEnv({ REPORT_SESSION_SECRET: undefined, ABUSE_PROTECTION_SECRET: undefined }),
  );
  const report = formatRequiredEnvIssues(issues);

  assert.match(report, /REPORT_SESSION_SECRET/);
  assert.match(report, /is not set/);
  // A bare variable name would not have shortened the outage this came from.
  assert.match(report, /sign-in|rate limiter/i);
});

test("builds fail only where configuration is managed", () => {
  assert.equal(shouldFailOnEnvIssues({ VERCEL: "1" }), true);
  assert.equal(shouldFailOnEnvIssues({ CI: "true" }), true);
  // A developer building locally gets a warning, not a broken workflow.
  assert.equal(shouldFailOnEnvIssues({}), false);
});

test("configuration errors are distinguishable from ordinary failures", () => {
  assert.equal(isConfigurationError(new ConfigurationError("missing")), true);
  assert.equal(isConfigurationError(new Error("database is down")), false);
  assert.equal(isConfigurationError(undefined), false);
});
