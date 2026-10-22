import assert from "node:assert/strict";
import test from "node:test";

import {
  applyReportLifecycleUpdates,
  deriveReportLifecycleStatus,
  getLifecyclePersistencePatch,
  matchesLifecycleFilter,
  hasReportVisibilityExpired,
  isEligiblePublicReport,
} from "@/lib/report-lifecycle";

const NOW = new Date("2026-08-16T12:00:00.000Z");

function createReport(overrides: Record<string, unknown> = {}) {
  return {
    status: "Needs More Confirmation",
    severity: "Moderate",
    confirmationCount: 0,
    resolvedCount: 0,
    createdAt: NOW,
    updatedAt: NOW,
    lastActivityAt: NOW,
    resolvedAt: null,
    archivedAt: null,
    ...overrides,
  };
}

test("community confirmation thresholds advance report status", () => {
  assert.equal(
    deriveReportLifecycleStatus(createReport({ confirmationCount: 2 }), NOW),
    "Confirmed by Community",
  );
  assert.equal(
    deriveReportLifecycleStatus(createReport({ resolvedCount: 2 }), NOW),
    "Likely Receded",
  );
  assert.equal(
    deriveReportLifecycleStatus(createReport({ resolvedCount: 3 }), NOW),
    "Resolved",
  );
});

test("visibility uses submission time and saved duration", () => {
  for (const hours of [12, 24, 48, 72] as const) {
    const createdAt = new Date(NOW.getTime() - hours * 3_600_000);
    const settings = { publicReportVisibilityHours: hours, showLikelyRecededReports: true, autoArchiveExpiredReports: true };
    const expired = createReport({ createdAt, lastActivityAt: NOW, verificationStatus: "verified", resolvedCount: 2 });
    assert.equal(hasReportVisibilityExpired(expired, NOW, settings), true);
    assert.equal(isEligiblePublicReport(expired, NOW, settings), false);
    assert.equal(isEligiblePublicReport(createReport({ ...expired, createdAt: new Date(createdAt.getTime() + 1) }), NOW, settings), true);
  }
});

test("authorization and visibility settings are independent", () => {
  const receded = createReport({ verificationStatus: "verified", resolvedCount: 2 });
  assert.equal(isEligiblePublicReport(receded, NOW), true);
  assert.equal(isEligiblePublicReport(receded, NOW, { publicReportVisibilityHours: 24, showLikelyRecededReports: false, autoArchiveExpiredReports: true }), false);
  for (const verificationStatus of ["unreviewed", "disputed", "rejected"]) assert.equal(isEligiblePublicReport(createReport({ verificationStatus }), NOW), false);
  const expired = createReport({ createdAt: new Date(NOW.getTime() - 25 * 3_600_000), verificationStatus: "verified" });
  assert.equal(isEligiblePublicReport(expired, NOW, { publicReportVisibilityHours: 24, showLikelyRecededReports: true, autoArchiveExpiredReports: false }), false);
});

test("lifecycle updates set missing transition timestamps", () => {
  assert.deepEqual(
    applyReportLifecycleUpdates(createReport({ resolvedCount: 3 }), NOW),
    { status: "Resolved", resolvedAt: NOW },
  );

  const inactiveAt = new Date(NOW.getTime() - 24 * 60 * 60 * 1000);
  assert.deepEqual(
    applyReportLifecycleUpdates(createReport({ createdAt: inactiveAt }), NOW),
    { status: "Archived", archivedAt: NOW },
  );
});

test("persistence patches only include changed lifecycle fields", () => {
  assert.deepEqual(getLifecyclePersistencePatch(createReport(), NOW), {});
  assert.deepEqual(
    getLifecyclePersistencePatch(createReport({ confirmationCount: 2 }), NOW),
    { status: "Confirmed by Community" },
  );
});

test("lifecycle filters select the expected public states", () => {
  assert.equal(matchesLifecycleFilter("Needs More Confirmation", "active"), true);
  assert.equal(matchesLifecycleFilter("Confirmed by Community", "active"), true);
  assert.equal(matchesLifecycleFilter("Likely Receded", "active"), true);
  assert.equal(matchesLifecycleFilter("Likely Receded", "receded"), true);
  assert.equal(matchesLifecycleFilter("Resolved", "resolved"), true);
  assert.equal(matchesLifecycleFilter("Archived", "archived"), true);
  assert.equal(matchesLifecycleFilter("Archived", "active"), false);
});
