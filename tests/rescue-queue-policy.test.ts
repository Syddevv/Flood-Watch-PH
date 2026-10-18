import assert from "node:assert/strict";
import test from "node:test";
import { isRescueTriageOverdue, parseAdminRescueFilters } from "@/lib/rescue-queue-policy";

test("queue filters validate scope and never accept arbitrary status", () => {
  assert.equal(parseAdminRescueFilters(new URLSearchParams("status=received&priority=critical&sort=oldest")).sort, "oldest");
  assert.throws(() => parseAdminRescueFilters(new URLSearchParams("status=dispatched")), /Invalid rescue queue filter/);
  assert.throws(() => parseAdminRescueFilters(new URLSearchParams("localityCode=outside")), /Invalid rescue queue filter/);
});

test("15-minute attention flag applies only to untriaged requests", () => {
  const now = new Date("2026-10-20T12:00:00.000Z");
  assert.equal(isRescueTriageOverdue({ status: "received", createdAt: new Date("2026-10-20T11:45:00.000Z") }, now), true);
  assert.equal(isRescueTriageOverdue({ status: "received", createdAt: new Date("2026-10-20T11:46:00.000Z") }, now), false);
  assert.equal(isRescueTriageOverdue({ status: "triaged", createdAt: new Date("2026-10-20T11:30:00.000Z") }, now), false);
});
