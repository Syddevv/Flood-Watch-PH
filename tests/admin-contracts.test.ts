import assert from "node:assert/strict";
import test from "node:test";

import {
  publicStatusForOperationalAction,
  canTransitionAdminReportStatus,
  isAdminSettingKey,
  isAdminReportStatus,
  parseAdminPagination,
  parseExpectedUpdatedAt,
  inferAdminReportStatus,
} from "@/lib/admin-contracts";
import { adminErrorResponse, adminSuccessResponse } from "@/lib/admin-api-response";

test("admin report status validation accepts only supported statuses", () => {
  assert.equal(isAdminReportStatus("under_review"), true);
  assert.equal(isAdminReportStatus("unknown"), false);
});

test("admin pagination is bounded and defaults safely", () => {
  const params = new URLSearchParams({ page: "3", limit: "500" });
  assert.deepEqual(parseAdminPagination(params), { page: 3, limit: 50 });
  assert.deepEqual(parseAdminPagination(new URLSearchParams()), {
    page: 1,
    limit: 20,
  });
});

test("expected updated-at parsing distinguishes absent and invalid values", () => {
  assert.equal(parseExpectedUpdatedAt(null), undefined);
  assert.equal(parseExpectedUpdatedAt("invalid"), null);
  assert.ok(parseExpectedUpdatedAt("2026-09-06T00:00:00.000Z") instanceof Date);
});

test("admin status transitions follow the operational matrix", () => {
  assert.equal(canTransitionAdminReportStatus("pending", "under_review"), true);
  assert.equal(canTransitionAdminReportStatus("pending", "resolved"), false);
  assert.equal(canTransitionAdminReportStatus("verified", "verified"), true);
});

test("operational action preserves community confirmation rather than inventing it", () => {
  assert.equal(publicStatusForOperationalAction("pending", 0), "Needs More Confirmation");
  assert.equal(publicStatusForOperationalAction("responding", 0), "Needs More Confirmation");
  assert.equal(publicStatusForOperationalAction("under_review", 2), "Confirmed by Community");
  assert.equal(publicStatusForOperationalAction("resolved", 0), "Resolved");
  assert.equal(publicStatusForOperationalAction("closed", 0), "Archived");
});

test("community confirmation never implies administrator verification", () => {
  assert.equal(inferAdminReportStatus({ status: "Confirmed by Community", archivedAt: null, resolvedAt: null }), "pending");
  assert.equal(inferAdminReportStatus({ status: "Confirmed by Community", archivedAt: null, resolvedAt: null }, "under_review"), "under_review");
});

test("admin settings accept only approved keys", () => {
  assert.equal(isAdminSettingKey("operationsCenterName"), true);
  assert.equal(isAdminSettingKey("databaseUrl"), false);
});

test("admin responses include a correlation ID and stable envelope", async () => {
  const request = new Request("http://localhost/api/admin/reports", {
    headers: { "x-request-id": "phase0-test" },
  });
  const success = adminSuccessResponse(request, { ok: true });
  assert.equal(success.headers.get("x-request-id"), "phase0-test");
  assert.deepEqual(await success.json(), {
    data: { ok: true },
    error: null,
    requestId: "phase0-test",
  });
  const failure = adminErrorResponse(request, "Nope", 403);
  assert.equal(failure.status, 403);
  assert.deepEqual(await failure.json(), {
    data: null,
    error: "Nope",
    requestId: "phase0-test",
  });
});
