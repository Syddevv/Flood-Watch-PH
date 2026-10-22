import assert from "node:assert/strict";
import test from "node:test";

import { findRequiredEnvIssues } from "@/lib/required-env";
import { isRolloutEnabled, pausedRolloutFeature, ROLLOUT_FLAGS } from "@/lib/rollout-gates";

test("rollout gates preserve current behavior until explicitly paused", () => {
  for (const feature of Object.keys(ROLLOUT_FLAGS) as Array<keyof typeof ROLLOUT_FLAGS>) {
    assert.equal(isRolloutEnabled(feature, {}), true);
    assert.equal(isRolloutEnabled(feature, { [ROLLOUT_FLAGS[feature]]: "on" }), true);
    assert.equal(isRolloutEnabled(feature, { [ROLLOUT_FLAGS[feature]]: "off" }), false);
    assert.equal(isRolloutEnabled(feature, { [ROLLOUT_FLAGS[feature]]: "oops" }), false);
  }
});

test("pauses only the intended intake, action, and center routes", () => {
  const env = Object.fromEntries(Object.values(ROLLOUT_FLAGS).map((name) => [name, "off"]));
  assert.equal(pausedRolloutFeature("/api/auth/register", "POST", env), "registration");
  assert.equal(pausedRolloutFeature("/api/reports", "POST", env), "reports");
  assert.equal(pausedRolloutFeature("/api/evacuation-centers/id", "GET", env), "centers");
  assert.equal(pausedRolloutFeature("/api/evacuation-centers", "GET", env), "centers");
  assert.equal(pausedRolloutFeature("/api/auth/verify-code", "POST", env), null);
  assert.equal(pausedRolloutFeature("/api/auth/login", "POST", env), null);
  assert.equal(pausedRolloutFeature("/api/reports", "GET", env), null);
});

test("deployment configuration rejects misspelled rollout values", () => {
  const name = ROLLOUT_FLAGS.centers;
  assert.equal(findRequiredEnvIssues({ [name]: "false" }).some((issue) => issue.name === name && issue.problem === "invalid"), true);
});
