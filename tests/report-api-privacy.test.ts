import assert from "node:assert/strict";
import test from "node:test";

import { serializeReportRecord } from "@/lib/report-api";

function createReport(overrides: Record<string, unknown> = {}) {
  return {
    id: "report-1",
    title: "Flooded road",
    description: "Water on the road.",
    category: "Flooding",
    severity: "High",
    status: "Needs More Confirmation",
    locationName: "Marikina City",
    latitude: 14.65,
    longitude: 121.1,
    locationSource: "manual",
    gpsAccuracyMeters: null,
    imageUrl: null,
    photoCapturedAt: null,
    ownerSessionHash: "owner-session",
    userId: null,
    reportedByName: "Private Reporter",
    sourceType: "Community" as const,
    confirmationCount: 0,
    resolvedCount: 0,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    lastActivityAt: new Date("2026-01-01T00:00:00Z"),
    resolvedAt: null,
    archivedAt: null,
    ...overrides,
  };
}

const legacyReport = createReport();

test("reporter names are redacted from public report responses", () => {
  assert.equal(
    serializeReportRecord(legacyReport, { sessionHash: "other-session" }).reportedByName,
    null,
  );
  assert.equal(
    serializeReportRecord(legacyReport, { sessionHash: "owner-session" }).reportedByName,
    "Private Reporter",
  );
});

test("a legacy report (session-hash only) is owned by matching session hash, not by any userId", () => {
  assert.equal(serializeReportRecord(legacyReport, { userId: "user-1" }).isOwner, false);
  assert.equal(
    serializeReportRecord(legacyReport, { sessionHash: "owner-session" }).isOwner,
    true,
  );
});

test("a user-owned report is owned by matching userId, not by any session hash", () => {
  const userReport = createReport({ ownerSessionHash: null, userId: "user-1" });

  assert.equal(serializeReportRecord(userReport, { sessionHash: "owner-session" }).isOwner, false);
  assert.equal(serializeReportRecord(userReport, { userId: "user-2" }).isOwner, false);
  assert.equal(serializeReportRecord(userReport, { userId: "user-1" }).isOwner, true);
});

test("an admin identity owns every report regardless of session hash or userId", () => {
  const userReport = createReport({ ownerSessionHash: null, userId: "user-1" });

  assert.equal(
    serializeReportRecord(legacyReport, { userId: "someone-else", role: "admin" }).isOwner,
    true,
  );
  assert.equal(
    serializeReportRecord(userReport, { userId: "someone-else", role: "admin" }).isOwner,
    true,
  );
});

test("precise GPS evidence stays private while onsite eligibility is exposed", () => {
  const onsiteReport = createReport({
    gpsLatitude: 14.9161,
    gpsLongitude: 120.7661,
    gpsCapturedAt: new Date("2026-01-01T00:00:00Z"),
    onsitePolicyVersion: "u2-provisional-2026-10-17",
    onsiteEligibleAt: new Date("2026-01-01T00:00:01Z"),
  });
  const serialized = serializeReportRecord(onsiteReport);

  assert.equal("gpsLatitude" in serialized, false);
  assert.equal("gpsLongitude" in serialized, false);
  assert.equal("gpsCapturedAt" in serialized, false);
  assert.equal("onsiteEligibleAt" in serialized, false);
  assert.equal(serialized.onsiteEligible, true);
  assert.equal(serializeReportRecord(legacyReport).onsiteEligible, false);
});
