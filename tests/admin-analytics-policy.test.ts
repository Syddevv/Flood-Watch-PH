import assert from "node:assert/strict";
import test from "node:test";
import { analyticsToCsv, bucketIndex, csvCell, makeBuckets, parseAnalyticsFilters, type AnalyticsData } from "@/lib/admin-analytics-policy";

test("Manila dates use fixed UTC+8 boundaries and reject oversized or invalid ranges", () => {
  const filters = parseAnalyticsFilters(new URLSearchParams("from=2026-10-17&to=2026-10-18&grain=hour"), new Date("2026-10-18T12:00:00Z"));
  assert.equal(filters.start.toISOString(), "2026-10-16T16:00:00.000Z");
  assert.equal(filters.end.toISOString(), "2026-10-18T16:00:00.000Z");
  assert.equal(makeBuckets(filters).length, 48);
  assert.equal(bucketIndex(new Date("2026-10-17T15:59:59Z"), filters), 23);
  assert.equal(bucketIndex(new Date("2026-10-17T16:00:00Z"), filters), 24);
  assert.throws(() => parseAnalyticsFilters(new URLSearchParams("from=2026-02-30&to=2026-03-01")), /Invalid calendar date/);
  assert.throws(() => parseAnalyticsFilters(new URLSearchParams("from=2026-01-01&to=2026-10-18")), /31 days/);
  assert.throws(() => parseAnalyticsFilters(new URLSearchParams("localityId=not-bulacan")), /locality/);
});

test("CSV fields remain safe", () => {
  assert.equal(csvCell('  =HYPERLINK("x")'), '"\'  =HYPERLINK(""x"")"');
  assert.equal(csvCell("a,b\nc"), '"a,b\nc"');
  const filters = parseAnalyticsFilters(new URLSearchParams("from=2026-10-18&to=2026-10-18"), new Date("2026-10-18T12:00:00Z"));
  const buckets = makeBuckets(filters);
  assert.equal(buckets.length, 1);
  assert.equal(buckets[0].reports, 0);
  const data: AnalyticsData = {
    filters: { from: filters.from, to: filters.to, grain: filters.grain, localityId: "" }, asOf: "2026-10-18T12:00:00.000Z",
    sources: { reports: "complete", incidents: "complete" },
    totals: { reportIntake: 0, visibleReports: 0, incidents: 0 }, buckets,
    severity: [], snapshots: { verificationBacklog: 0, oldestUnreviewedMinutes: null, activeIncidents: 0, shelterOccupancy: null },
  };
  assert.match(analyticsToCsv(data), /"range","2026-10-18 to 2026-10-18","report intake","0","complete"/);
  assert.doesNotMatch(analyticsToCsv(data), /rescue|dispatch|response duration/i);
});
