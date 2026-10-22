import assert from "node:assert/strict";
import test from "node:test";
import { ADMIN_SETTINGS_DEFAULTS, parseAdminSettings, settingsFromRows } from "@/lib/admin-settings-config";
import { isRecentMonitoringReport } from "@/lib/admin-operations-policy";

test("settings load defaults and persisted values", () => {
  assert.deepEqual(settingsFromRows([]), ADMIN_SETTINGS_DEFAULTS);
  assert.equal(settingsFromRows([{ key: "recentReportHours", value: "24" }]).recentReportHours, 24);
  assert.equal(settingsFromRows([{ key: "highSeverityAlerts", value: "false" }]).highSeverityAlerts, false);
  assert.equal(settingsFromRows([{ key: "publicReportVisibilityHours", value: "48" }]).publicReportVisibilityHours, 48);
  assert.equal(settingsFromRows([{ key: "showLikelyRecededReports", value: "false" }]).showLikelyRecededReports, false);
  assert.equal(settingsFromRows([{ key: "autoArchiveExpiredReports", value: "false" }]).autoArchiveExpiredReports, false);
});

test("settings reject unknown keys and invalid values", () => {
  assert.equal(parseAdminSettings({ ...ADMIN_SETTINGS_DEFAULTS, recentReportHours: 12 }), null);
  assert.equal(parseAdminSettings({ ...ADMIN_SETTINGS_DEFAULTS, centerUpdateAlerts: "false" }), null);
  assert.equal(parseAdminSettings({ ...ADMIN_SETTINGS_DEFAULTS, publicReportVisibilityHours: 36 }), null);
  assert.equal(parseAdminSettings({ ...ADMIN_SETTINGS_DEFAULTS, disableVerification: true }), null);
});

test("recent-report window changes classification without changing report data", () => {
  const now = Date.parse("2026-10-22T12:00:00Z");
  const report = { createdAt: new Date(now - 36 * 3_600_000).toISOString(), status: "Needs More Confirmation", verificationStatus: "unreviewed" };
  assert.equal(isRecentMonitoringReport(report, now, 24 * 3_600_000), false);
  assert.equal(isRecentMonitoringReport(report, now, 48 * 3_600_000), true);
});
