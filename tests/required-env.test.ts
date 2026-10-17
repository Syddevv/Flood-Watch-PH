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
    EMAIL_PROVIDER: "emailjs",
    EMAILJS_SERVICE_ID: "service_test",
    EMAILJS_TEMPLATE_ID: "template_test",
    EMAILJS_PUBLIC_KEY: "public_test",
    EMAILJS_PRIVATE_KEY: "private_test",
    EMAIL_VERIFICATION_HMAC_KEY: VALID_SECRET,
    LEGACY_EMAIL_GRACE_DEADLINE: "2099-01-01T00:00:00.000Z",
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

test("email verification secrets are required for deployed registration", () => {
  const issues = findRequiredEnvIssues(
    completeEnv({ EMAIL_VERIFICATION_HMAC_KEY: undefined }),
  );
  assert.equal(
    issues.some(
      (issue) =>
        issue.name === "EMAIL_VERIFICATION_HMAC_KEY" && issue.severity === "error",
    ),
    true,
  );
});

test("all EmailJS credentials are required and obsolete Resend values do not satisfy them", () => {
  const issues = findRequiredEnvIssues(
    completeEnv({
      EMAILJS_TEMPLATE_ID: undefined,
      RESEND_API_KEY: "re_obsolete",
      EMAIL_FROM_ADDRESS: "Flood Watch <verify@example.com>",
      RESEND_WEBHOOK_SECRET: "whsec_obsolete",
    }),
  );

  assert.equal(
    issues.some(
      (issue) => issue.name === "EMAILJS_TEMPLATE_ID" && issue.problem === "missing",
    ),
    true,
  );
  assert.equal(issues.some((issue) => issue.name.startsWith("RESEND_")), false);
});

test("malformed EmailJS values and deployed origins are reported", () => {
  const issues = findRequiredEnvIssues(
    completeEnv({
      EMAILJS_PRIVATE_KEY: "private\nkey",
      NEXT_PUBLIC_APP_URL: "https://example.com/not-an-origin",
    }),
  );

  assert.equal(
    issues.some(
      (issue) => issue.name === "EMAILJS_PRIVATE_KEY" && issue.problem === "invalid",
    ),
    true,
  );
  assert.equal(
    issues.some(
      (issue) =>
        issue.name === "NEXT_PUBLIC_APP_URL" &&
        issue.problem === "invalid" &&
        issue.severity === "error",
    ),
    true,
  );
});

test("the deployed application origin is required for secure fallback validation", () => {
  const issues = findRequiredEnvIssues(
    completeEnv({ NEXT_PUBLIC_APP_URL: undefined }),
  );

  assert.equal(
    issues.some(
      (issue) =>
        issue.name === "NEXT_PUBLIC_APP_URL" &&
        issue.problem === "missing" &&
        issue.severity === "error",
    ),
    true,
  );
});

test("email provider and legacy grace deadline values are validated", () => {
  const issues = findRequiredEnvIssues(
    completeEnv({ EMAIL_PROVIDER: "smtp", LEGACY_EMAIL_GRACE_DEADLINE: "someday" }),
  );
  assert.equal(
    issues.some((issue) => issue.name === "EMAIL_PROVIDER" && issue.problem === "invalid"),
    true,
  );
  assert.equal(
    issues.some(
      (issue) =>
        issue.name === "LEGACY_EMAIL_GRACE_DEADLINE" && issue.problem === "invalid",
    ),
    true,
  );
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
