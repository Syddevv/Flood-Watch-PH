import "server-only";
import { prisma } from "@/lib/prisma";
import { ANALYTICS_ROW_LIMIT, bucketIndex, makeBuckets, type AnalyticsData, type AnalyticsFilters, type SourceState } from "@/lib/admin-analytics-policy";

const ACTIVE = ["Needs More Confirmation", "Confirmed by Community"];
const VALID_SEVERITY = ["Low", "Moderate", "High", "Critical"];

/** Bounded report and incident reads; an unavailable source is never shown as zero. */
export async function loadAdminAnalytics(filters: AnalyticsFilters): Promise<AnalyticsData> {
  const asOf = new Date();
  const range = { gte: filters.start, lt: filters.end, lte: asOf };
  const limited = ANALYTICS_ROW_LIMIT + 1;
  const [reportResult, incidentResult, backlogResult, oldestResult, activeResult] = await Promise.allSettled([
    filters.localityId ? Promise.resolve(null) : prisma.floodReport.findMany({ where: { createdAt: range }, select: { id: true, createdAt: true, severity: true, verificationStatus: true, archivedAt: true }, take: limited }),
    filters.localityId ? Promise.resolve(null) : prisma.incident.findMany({ where: { createdAt: range }, select: { id: true, createdAt: true }, take: limited }),
    filters.localityId ? Promise.resolve(null) : prisma.floodReport.count({ where: { archivedAt: null, status: { in: ACTIVE }, verificationStatus: { in: ["unreviewed", "disputed"] } } }),
    filters.localityId ? Promise.resolve(null) : prisma.floodReport.findFirst({ where: { archivedAt: null, status: { in: ACTIVE }, verificationStatus: { in: ["unreviewed", "disputed"] } }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    filters.localityId ? Promise.resolve(null) : prisma.incident.count({ where: { archivedAt: null, status: { in: ACTIVE } } }),
  ]);
  const usable = <T>(result: PromiseSettledResult<T | null>) => result.status === "fulfilled" ? result.value : null;
  const reports = usable(reportResult);
  const incidents = usable(incidentResult);
  const state = (rows: unknown[] | null, localityMissing = false): SourceState => localityMissing ? "locality_unavailable" : rows !== null && rows.length <= ANALYTICS_ROW_LIMIT ? "complete" : "unavailable";
  const sources: AnalyticsData["sources"] = {
    reports: state(reports, Boolean(filters.localityId)), incidents: state(incidents, Boolean(filters.localityId)),
  };
  const buckets = makeBuckets(filters);
  if (sources.reports !== "complete") for (const bucket of buckets) { bucket.reports = null; bucket.visibleReports = null; }
  if (sources.incidents !== "complete") for (const bucket of buckets) bucket.incidents = null;
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
  return {
    filters: { from: filters.from, to: filters.to, grain: filters.grain, localityId: filters.localityId }, asOf: asOf.toISOString(), sources,
    totals: {
      reportIntake: sources.reports === "complete" ? reports!.length : null,
      visibleReports: sources.reports === "complete" ? reports!.filter(visible).length : null,
      incidents: sources.incidents === "complete" ? incidents!.length : null,
    }, buckets,
    severity: sources.reports === "complete" ? [...severityCounts].map(([label, count]) => ({ label, count })) : null,
    snapshots: {
      verificationBacklog: sources.reports !== "complete" ? null : usable(backlogResult),
      oldestUnreviewedMinutes: sources.reports !== "complete" || !usable(oldestResult) ? null : Math.max(0, Math.floor((asOf.getTime() - usable(oldestResult)!.createdAt.getTime()) / 60_000)),
      activeIncidents: sources.incidents !== "complete" ? null : usable(activeResult), shelterOccupancy: null,
    },
  };
}
