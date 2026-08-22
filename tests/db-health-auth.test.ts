import assert from "node:assert/strict";
import test from "node:test";

import { isDatabaseHealthRequestAuthorized } from "@/lib/db-health-auth";

const originalNodeEnv = process.env.NODE_ENV;
const originalToken = process.env.DB_HEALTH_TOKEN;
const mutableEnv = process.env as Record<string, string | undefined>;

test.afterEach(() => {
  if (originalNodeEnv === undefined) delete mutableEnv.NODE_ENV;
  else mutableEnv.NODE_ENV = originalNodeEnv;
  if (originalToken === undefined) delete mutableEnv.DB_HEALTH_TOKEN;
  else mutableEnv.DB_HEALTH_TOKEN = originalToken;
});

test("database health requires the configured bearer token", () => {
  mutableEnv.NODE_ENV = "production";
  mutableEnv.DB_HEALTH_TOKEN = "health-secret";

  assert.equal(
    isDatabaseHealthRequestAuthorized(
      new Request("http://localhost/api/db-health", {
        headers: { Authorization: "Bearer health-secret" },
      }),
    ),
    true,
  );
  assert.equal(
    isDatabaseHealthRequestAuthorized(new Request("http://localhost/api/db-health")),
    false,
  );
});

test("production database health access is denied when no token is configured", () => {
  mutableEnv.NODE_ENV = "production";
  delete mutableEnv.DB_HEALTH_TOKEN;
  assert.equal(
    isDatabaseHealthRequestAuthorized(new Request("http://localhost/api/db-health")),
    false,
  );
});

test("local development remains accessible without deployment credentials", () => {
  mutableEnv.NODE_ENV = "development";
  delete mutableEnv.DB_HEALTH_TOKEN;
  assert.equal(
    isDatabaseHealthRequestAuthorized(new Request("http://localhost/api/db-health")),
    true,
  );
});
