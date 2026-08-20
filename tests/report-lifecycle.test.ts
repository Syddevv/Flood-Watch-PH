import assert from "node:assert/strict";
import test from "node:test";

import {
  applyReportLifecycleUpdates,
  deriveReportLifecycleStatus,
  getLifecyclePersistencePatch,
  matchesLifecycleFilter,
  shouldAutoArchiveInactiveReport,
  shouldArchiveResolvedReport,
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

test("resolved reports archive after 24 hours", () => {
  const beforeThreshold = new Date(NOW.getTime() - 24 * 60 * 60 * 1000 + 1);
  const atThreshold = new Date(NOW.getTime() - 24 * 60 * 60 * 1000);

  assert.equal(
    shouldArchiveResolvedReport({ resolvedAt: beforeThreshold, archivedAt: null }, NOW),
    false,
  );
  assert.equal(
    shouldArchiveResolvedReport({ resolvedAt: atThreshold, archivedAt: null }, NOW),
    true,
  );
});

test("inactive reports use severity-specific archive windows", () => {
  const twelveHoursAgo = new Date(NOW.getTime() - 12 * 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(NOW.getTime() - 24 * 60 * 60 * 1000);

  assert.equal(
    shouldAutoArchiveInactiveReport(
      createReport({ severity: "Low", lastActivityAt: twelveHoursAgo }),
      NOW,
    ),
    true,
  );
  assert.equal(
    shouldAutoArchiveInactiveReport(
      createReport({ severity: "High", lastActivityAt: twelveHoursAgo }),
      NOW,
    ),
    false,
  );
  assert.equal(
    shouldAutoArchiveInactiveReport(
      createReport({ severity: "Critical", lastActivityAt: twentyFourHoursAgo }),
      NOW,
    ),
    true,
  );
});

test("resolved or archived reports are not auto-archived for inactivity", () => {
  const oldActivity = new Date(NOW.getTime() - 48 * 60 * 60 * 1000);

  assert.equal(
    shouldAutoArchiveInactiveReport(
      createReport({ lastActivityAt: oldActivity, resolvedAt: NOW }),
      NOW,
    ),
    false,
  );
  assert.equal(
    shouldAutoArchiveInactiveReport(
      createReport({ lastActivityAt: oldActivity, archivedAt: NOW }),
      NOW,
    ),
    false,
  );
});

test("lifecycle updates set missing transition timestamps", () => {
  assert.deepEqual(
    applyReportLifecycleUpdates(createReport({ resolvedCount: 3 }), NOW),
    { status: "Resolved", resolvedAt: NOW },
  );

  const inactiveAt = new Date(NOW.getTime() - 12 * 60 * 60 * 1000);
  assert.deepEqual(
    applyReportLifecycleUpdates(createReport({ lastActivityAt: inactiveAt }), NOW),
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
  assert.equal(matchesLifecycleFilter("Likely Receded", "receded"), true);
  assert.equal(matchesLifecycleFilter("Resolved", "resolved"), true);
  assert.equal(matchesLifecycleFilter("Archived", "archived"), true);
  assert.equal(matchesLifecycleFilter("Archived", "active"), false);
});
