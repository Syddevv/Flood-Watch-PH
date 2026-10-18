import { BULACAN_LOCALITIES } from "@/data/bulacan-localities";

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000; // Asia/Manila has no DST.
const DAY_MS = 24 * 60 * 60 * 1000;
export const ANALYTICS_ROW_LIMIT = 5000;

export class AnalyticsFilterError extends Error {}

function parseDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new AnalyticsFilterError("Use YYYY-MM-DD dates.");
  const utc = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(utc) || new Date(utc).toISOString().slice(0, 10) !== value) throw new AnalyticsFilterError("Invalid calendar date.");
  return utc - MANILA_OFFSET_MS;
}

export function parseAnalyticsFilters(params: URLSearchParams, now = new Date()) {
  const today = new Date(now.getTime() + MANILA_OFFSET_MS).toISOString().slice(0, 10);
  const defaultFrom = new Date(parseDay(today) - 6 * DAY_MS + MANILA_OFFSET_MS).toISOString().slice(0, 10);
  const from = params.get("from") ?? defaultFrom;
  const to = params.get("to") ?? today;
  const grain = params.get("grain") ?? "day";
  const localityId = params.get("localityId") ?? "";
  const startMs = parseDay(from);
  const endMs = parseDay(to) + DAY_MS;
  if (startMs >= endMs || endMs - startMs > 31 * DAY_MS || endMs > now.getTime() + DAY_MS || !["day", "hour"].includes(grain) ||
      (grain === "hour" && endMs - startMs > 2 * DAY_MS) ||
      (localityId && !BULACAN_LOCALITIES.some((place) => place.code === localityId)) ||
      [...params.keys()].some((key) => !["from", "to", "grain", "localityId"].includes(key))) {
    throw new AnalyticsFilterError("Choose a valid locality and a range of at most 31 days (2 days for hourly charts).");
  }
  return { from, to, grain: grain as "day" | "hour", localityId, start: new Date(startMs), end: new Date(endMs) };
}

export type AnalyticsFilters = ReturnType<typeof parseAnalyticsFilters>;
export type SourceState = "complete" | "unavailable" | "locality_unavailable";
export type AnalyticsData = {
  filters: { from: string; to: string; grain: "day" | "hour"; localityId: string };
  asOf: string;
  sources: { reports: SourceState; incidents: SourceState; rescues: SourceState; responseTimes: SourceState };
  totals: { reportIntake: number | null; visibleReports: number | null; incidents: number | null; rescues: number | null; cancelledRescues: number | null; rejectedRescues: number | null };
  buckets: { start: string; label: string; reports: number | null; visibleReports: number | null; incidents: number | null; rescues: number | null }[];
  severity: { label: string; count: number }[] | null;
  geography: { localityId: string; label: string; rescues: number }[] | null;
  responseTimes: { stage: string; sampleSize: number; medianMinutes: number | null; p90Minutes: number | null }[] | null;
  snapshots: { verificationBacklog: number | null; oldestUnreviewedMinutes: number | null; activeIncidents: number | null; criticalRescues: number | null; shelterOccupancy: null };
};

export function makeBuckets(filters: AnalyticsFilters) {
  const step = filters.grain === "hour" ? 60 * 60 * 1000 : DAY_MS;
  const buckets: AnalyticsData["buckets"] = [];
  for (let time = filters.start.getTime(); time < filters.end.getTime(); time += step) {
    const local = new Date(time + MANILA_OFFSET_MS).toISOString();
    buckets.push({ start: new Date(time).toISOString(), label: filters.grain === "hour" ? `${local.slice(0, 10)} ${local.slice(11, 16)}` : local.slice(0, 10), reports: 0, visibleReports: 0, incidents: 0, rescues: 0 });
  }
  return buckets;
}

export function bucketIndex(date: Date, filters: AnalyticsFilters) {
  const step = filters.grain === "hour" ? 60 * 60 * 1000 : DAY_MS;
  return Math.floor((date.getTime() - filters.start.getTime()) / step);
}

export function percentileMinutes(values: number[], percentile: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * percentile;
  const lower = Math.floor(position), upper = Math.ceil(position);
  const duration = sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
  return Math.round(duration / 60_000 * 10) / 10;
}

export function csvCell(value: string | number | null) {
  const raw = String(value ?? "");
  const safe = /^\s*[=+\-@]/.test(raw) || /^[\t\r\n]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function analyticsToCsv(data: AnalyticsData) {
  const rows: (string | number | null)[][] = [["section", "period", "metric", "value", "status"]];
  const add = (section: string, period: string, metric: string, value: number | null, status: SourceState | "snapshot" | "unavailable") => rows.push([section, period, metric, value, status]);
  const period = `${data.filters.from} to ${data.filters.to}`;
  add("range", period, "report intake", data.totals.reportIntake, data.sources.reports);
  add("range", period, "visible reports", data.totals.visibleReports, data.sources.reports);
  add("range", period, "distinct incidents", data.totals.incidents, data.sources.incidents);
  add("range", period, "rescue requests", data.totals.rescues, data.sources.rescues);
  add("range", period, "cancelled rescues", data.totals.cancelledRescues, data.sources.rescues);
  add("range", period, "rejected rescues", data.totals.rejectedRescues, data.sources.rescues);
  for (const bucket of data.buckets) for (const [metric, value, state] of [["report intake", bucket.reports, data.sources.reports], ["visible reports", bucket.visibleReports, data.sources.reports], ["distinct incidents", bucket.incidents, data.sources.incidents], ["rescue requests", bucket.rescues, data.sources.rescues]] as const) add("bucket", bucket.label, metric, value, state);
  for (const item of data.severity ?? []) add("severity", period, item.label, item.count, data.sources.reports);
  for (const item of data.geography ?? []) add("rescue locality", period, `${item.label} (${item.localityId})`, item.rescues, data.sources.rescues);
  for (const item of data.responseTimes ?? []) {
    add("response", period, `${item.stage} sample size`, item.sampleSize, data.sources.responseTimes);
    add("response", period, `${item.stage} median minutes`, item.medianMinutes, data.sources.responseTimes);
    add("response", period, `${item.stage} p90 minutes`, item.p90Minutes, data.sources.responseTimes);
  }
  add("snapshot", data.asOf, "verification backlog", data.snapshots.verificationBacklog, data.sources.reports === "complete" ? "snapshot" : data.sources.reports);
  add("snapshot", data.asOf, "oldest unreviewed minutes", data.snapshots.oldestUnreviewedMinutes, data.sources.reports === "complete" ? "snapshot" : data.sources.reports);
  add("snapshot", data.asOf, "active incidents", data.snapshots.activeIncidents, data.sources.incidents === "complete" ? "snapshot" : data.sources.incidents);
  add("snapshot", data.asOf, "critical rescues", data.snapshots.criticalRescues, data.sources.rescues === "complete" ? "snapshot" : data.sources.rescues);
  add("snapshot", data.asOf, "shelter occupancy", null, "unavailable");
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
