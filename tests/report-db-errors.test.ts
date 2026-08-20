import assert from "node:assert/strict";
import test from "node:test";

import { isReportDatabaseUnavailableError } from "@/lib/report-db-errors";

test("database connection errors are classified as unavailable", () => {
  assert.equal(isReportDatabaseUnavailableError({ code: "P1001" }), true);
  assert.equal(isReportDatabaseUnavailableError({ code: "P2024" }), true);
  assert.equal(isReportDatabaseUnavailableError(new Error("connect ETIMEDOUT")), true);
  assert.equal(isReportDatabaseUnavailableError(new Error("validation failed")), false);
});
