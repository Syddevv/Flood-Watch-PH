import "server-only";
import { BULACAN_LOCALITIES } from "@/data/bulacan-localities";
import { prisma } from "@/lib/prisma";
import { TERMINAL_RESCUE_STATUSES } from "@/lib/rescue-contracts";
import { ANALYTICS_ROW_LIMIT, bucketIndex, makeBuckets, percentileMinutes, type AnalyticsData, type AnalyticsFilters, type SourceState } from "@/lib/admin-analytics-policy";

const ACTIVE = ["Needs More Confirmation", "Confirmed by Community"];
const VALID_SEVERITY = ["Low", "Moderate", "High", "Critical"];

/**
 * Query plan: one bounded, narrow projection per source (at most 5,001 rows),
 * then one indexed requestId event lookup. No contact/location narrative or
 * vulnerability fields leave the database. A source over the cap is marked
 * unavailable, never silently counted from a truncated sample. The 31-day
 * range cap bounds scans; add createdAt indexes after EXPLAIN on representative
 * production volumes, not speculatively on a small test database.
 */
export async function loadAdminAnalytics(filters: AnalyticsFilters): Promise<AnalyticsData> {
  const asOf = new Date();
  const range = { gte: filters.start, lt: filters.end, lte: asOf };
  const limited = ANALYTICS_ROW_LIMIT + 1;
  const [reportResult, incidentResult, rescueResult, backlogResult, oldestResult, activeResult, criticalResult] = await Promise.allSettled([
    filters.localityId ? Promise.resolve(null) : prisma.floodReport.findMany({ where: { createdAt: range }, select: { id: true, createdAt: true, severity: true, verificationStatus: true, archivedAt: true }, take: limited }),
    filters.localityId ? Promise.resolve(null) : prisma.incident.findMany({ where: { createdAt: range }, select: { id: true, createdAt: true }, take: limited }),
    prisma.rescueRequest.findMany({ where: { createdAt: range, ...(filters.localityId ? { localityCode: filters.localityId } : {}) }, select: { id: true, createdAt: true, status: true, priority: true, localityCode: true }, take: limited }),
    filters.localityId ? Promise.resolve(null) : prisma.floodReport.count({ where: { archivedAt: null, status: { in: ACTIVE }, verificationStatus: { in: ["unreviewed", "disputed"] } } }),
    filters.localityId ? Promise.resolve(null) : prisma.floodReport.findFirst({ where: { archivedAt: null, status: { in: ACTIVE }, verificationStatus: { in: ["unreviewed", "disputed"] } }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    filters.localityId ? Promise.resolve(null) : prisma.incident.count({ where: { archivedAt: null, status: { in: ACTIVE } } }),
    prisma.rescueRequest.count({ where: { priority: "critical", status: { notIn: [...TERMINAL_RESCUE_STATUSES] }, ...(filters.localityId ? { localityCode: filters.localityId } : {}) } }),
  ]);
  const usable = <T>(result: PromiseSettledResult<T | null>) => result.status === "fulfilled" ? result.value : null;
  const reports = usable(reportResult);
  const incidents = usable(incidentResult);
  const rescues = usable(rescueResult);
  const state = (rows: unknown[] | null, localityMissing = false): SourceState => localityMissing ? "locality_unavailable" : rows !== null && rows.length <= ANALYTICS_ROW_LIMIT ? "complete" : "unavailable";
  const sources: AnalyticsData["sources"] = {
    reports: state(reports, Boolean(filters.localityId)), incidents: state(incidents, Boolean(filters.localityId)),
    rescues: state(rescues), responseTimes: "unavailable",
  };
  const buckets = makeBuckets(filters);
  if (sources.reports !== "complete") for (const bucket of buckets) { bucket.reports = null; bucket.visibleReports = null; }
  if (sources.incidents !== "complete") for (const bucket of buckets) bucket.incidents = null;
  if (sources.rescues !== "complete") for (const bucket of buckets) bucket.rescues = null;
  const bucketFor = (date: Date) => buckets[bucketIndex(date, filters)];
  const visible = (row: { archivedAt: Date | null; verificationStatus: string }) => !row.archivedAt && row.verificationStatus !== "rejected";
  const severityCounts = new Map<string, number>();
  if (sources.reports === "complete") for (const row of reports!) {
    const bucket = bucketFor(row.createdAt);
    if (!bucket) continue;
    bucket.reports!++;
    if (visible(row)) {
      bucket.visibleReports!++;
      const label = VALID_SEVERITY.includes(row.severity) ? row.severity : "Unknown/legacy";
      severityCounts.set(label, (severityCounts.get(label) ?? 0) + 1);
    }
  }
  if (sources.incidents === "complete") for (const row of incidents!) { const bucket = bucketFor(row.createdAt); if (bucket) bucket.incidents!++; }
  const geographyCounts = new Map<string, number>();
  if (sources.rescues === "complete") for (const row of rescues!) {
    const bucket = bucketFor(row.createdAt);
    if (bucket) bucket.rescues!++;
    geographyCounts.set(row.localityCode, (geographyCounts.get(row.localityCode) ?? 0) + 1);
  }
  let responseTimes: AnalyticsData["responseTimes"] = null;
  if (sources.rescues === "complete") {
    const events = rescues!.length ? await prisma.rescueRequestEvent.findMany({ where: { requestId: { in: rescues!.map((row) => row.id) }, nextStatus: { in: ["received", "triaged", "awaiting_responder", "dispatched", "resolved", "completed"] } }, select: { requestId: true, nextStatus: true, createdAt: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: ANALYTICS_ROW_LIMIT * 4 + 1 }).catch(() => null) : [];
    if (events && events.length <= ANALYTICS_ROW_LIMIT * 4) {
      sources.responseTimes = "complete";
      const received = new Map<string, number>();
      for (const event of events) if (event.nextStatus === "received" && !received.has(event.requestId)) received.set(event.requestId, event.createdAt.getTime());
      const samples = new Map<string, number[]>([["first triage", []], ["confirmed dispatch", []], ["completion", []]]);
      const seen = new Set<string>();
      for (const event of events) {
        if (event.nextStatus === "received") continue;
        const stage = ["triaged", "awaiting_responder"].includes(event.nextStatus ?? "") ? "first triage" : event.nextStatus === "dispatched" ? "confirmed dispatch" : "completion";
        const key = `${event.requestId}:${stage}`;
        const start = received.get(event.requestId);
        if (seen.has(key) || start === undefined || event.createdAt.getTime() < start) continue;
        seen.add(key);
        samples.get(stage)!.push(event.createdAt.getTime() - start);
      }
      responseTimes = [...samples].map(([stage, values]) => ({ stage, sampleSize: values.length, medianMinutes: percentileMinutes(values, 0.5), p90Minutes: percentileMinutes(values, 0.9) }));
    }
  }
  const localityNames = new Map<string, string>(BULACAN_LOCALITIES.map((place) => [place.code, place.name]));
  return {
    filters: { from: filters.from, to: filters.to, grain: filters.grain, localityId: filters.localityId }, asOf: asOf.toISOString(), sources,
    totals: {
      reportIntake: sources.reports === "complete" ? reports!.length : null,
      visibleReports: sources.reports === "complete" ? reports!.filter(visible).length : null,
      incidents: sources.incidents === "complete" ? incidents!.length : null,
      rescues: sources.rescues === "complete" ? rescues!.length : null,
      cancelledRescues: sources.rescues === "complete" ? rescues!.filter((row) => row.status === "cancelled").length : null,
      rejectedRescues: sources.rescues === "complete" ? rescues!.filter((row) => row.status === "rejected").length : null,
    }, buckets,
    severity: sources.reports === "complete" ? [...severityCounts].map(([label, count]) => ({ label, count })) : null,
    geography: sources.rescues === "complete" ? [...geographyCounts].map(([localityId, count]) => ({ localityId, label: localityNames.get(localityId) ?? "Unknown/legacy", rescues: count })).sort((a, b) => b.rescues - a.rescues) : null,
    responseTimes,
    snapshots: {
      verificationBacklog: sources.reports !== "complete" ? null : usable(backlogResult),
      oldestUnreviewedMinutes: sources.reports !== "complete" || !usable(oldestResult) ? null : Math.max(0, Math.floor((asOf.getTime() - usable(oldestResult)!.createdAt.getTime()) / 60_000)),
      activeIncidents: sources.incidents !== "complete" ? null : usable(activeResult),
      criticalRescues: sources.rescues !== "complete" ? null : usable(criticalResult), shelterOccupancy: null,
    },
  };
}
