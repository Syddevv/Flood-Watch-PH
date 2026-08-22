import assert from "node:assert/strict";
import test from "node:test";

import { serializeReportRecord } from "@/lib/report-api";

const report = {
  id: "report-1",
  title: "Flooded road",
  description: "Water on the road.",
  category: "Flooding",
  severity: "High",
  status: "Needs More Confirmation",
  locationName: "Marikina City",
  latitude: 14.65,
  longitude: 121.1,
  imageUrl: null,
  ownerSessionHash: "owner-session",
  reportedByName: "Private Reporter",
  sourceType: "Community" as const,
  confirmationCount: 0,
  resolvedCount: 0,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  lastActivityAt: new Date("2026-01-01T00:00:00Z"),
  resolvedAt: null,
  archivedAt: null,
};

test("reporter names are redacted from public report responses", () => {
  assert.equal(serializeReportRecord(report, "other-session").reportedByName, null);
  assert.equal(serializeReportRecord(report, "owner-session").reportedByName, "Private Reporter");
});
