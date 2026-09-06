import assert from "node:assert/strict";
import test from "node:test";

import {
  ADMIN_TO_PUBLIC_REPORT_STATUS,
  canTransitionAdminReportStatus,
  isAdminSettingKey,
  isAdminReportStatus,
  parseAdminPagination,
  parseExpectedUpdatedAt,
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

test("admin statuses map to the existing public lifecycle vocabulary", () => {
  assert.equal(ADMIN_TO_PUBLIC_REPORT_STATUS.pending, "Needs More Confirmation");
  assert.equal(ADMIN_TO_PUBLIC_REPORT_STATUS.responding, "Confirmed by Community");
  assert.equal(ADMIN_TO_PUBLIC_REPORT_STATUS.resolved, "Resolved");
  assert.equal(ADMIN_TO_PUBLIC_REPORT_STATUS.closed, "Archived");
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
