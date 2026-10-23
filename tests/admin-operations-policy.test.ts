import assert from "node:assert/strict";
import test from "node:test";
import { compactBulacanPlace, isRecentMonitoringReport, isRecentOperationalReport, matchesOperationsReportView, RECENT_REPORT_WINDOW_MS, relativeOperationalTime } from "@/lib/admin-operations-policy";

const now = Date.parse("2026-10-22T12:00:00.000Z");
const report = { createdAt: new Date(now - RECENT_REPORT_WINDOW_MS).toISOString(), status: "Needs More Confirmation", verificationStatus: "unreviewed" };

test("monitoring includes the 72-hour boundary and excludes older verified reports", () => {
  assert.equal(isRecentMonitoringReport(report, now), true);
  assert.equal(isRecentMonitoringReport({ ...report, createdAt: new Date(now - RECENT_REPORT_WINDOW_MS - 1).toISOString(), verificationStatus: "verified" }, now), false);
});

test("resolved, rejected, and future reports are not current monitoring conditions", () => {
  assert.equal(isRecentMonitoringReport({ ...report, status: "Resolved" }, now), false);
  assert.equal(isRecentMonitoringReport({ ...report, verificationStatus: "rejected" }, now), false);
  assert.equal(isRecentMonitoringReport({ ...report, createdAt: new Date(now + 1).toISOString() }, now), false);
});

test("operations views include verified reports regardless of age or flooding status", () => {
  const olderVerified = { ...report, createdAt: new Date(now - RECENT_REPORT_WINDOW_MS - 1).toISOString(), status: "Resolved", verificationStatus: "verified" };
  assert.equal(isRecentOperationalReport(olderVerified, now), false);
  assert.equal(matchesOperationsReportView(olderVerified, "verified", now), true);
  assert.equal(matchesOperationsReportView(olderVerified, "recent", now), false);
  assert.equal(matchesOperationsReportView(olderVerified, "all", now), true);
  const recentReceded = { ...report, status: "Likely Receded" };
  assert.equal(matchesOperationsReportView(recentReceded, "recent", now), true);
  assert.equal(matchesOperationsReportView(report, "pending", now), true);
});

test("compact locations and relative times keep list rows readable", () => {
  assert.equal(compactBulacanPlace("J.P. Rizal Street, Sucol, Calumpit, Bulacan"), "Sucol, Calumpit");
  assert.equal(relativeOperationalTime(new Date(now - 2 * 60 * 60 * 1000).toISOString(), now), "2 hr ago");
});
