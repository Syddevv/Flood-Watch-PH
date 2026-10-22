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
  sources: { reports: SourceState; incidents: SourceState };
  totals: { reportIntake: number | null; visibleReports: number | null; incidents: number | null };
  buckets: { start: string; label: string; reports: number | null; visibleReports: number | null; incidents: number | null }[];
  severity: { label: string; count: number }[] | null;
  snapshots: { verificationBacklog: number | null; oldestUnreviewedMinutes: number | null; activeIncidents: number | null; shelterOccupancy: null };
};

export function makeBuckets(filters: AnalyticsFilters) {
  const step = filters.grain === "hour" ? 60 * 60 * 1000 : DAY_MS;
  const buckets: AnalyticsData["buckets"] = [];
  for (let time = filters.start.getTime(); time < filters.end.getTime(); time += step) {
    const local = new Date(time + MANILA_OFFSET_MS).toISOString();
    buckets.push({ start: new Date(time).toISOString(), label: filters.grain === "hour" ? `${local.slice(0, 10)} ${local.slice(11, 16)}` : local.slice(0, 10), reports: 0, visibleReports: 0, incidents: 0 });
  }
  return buckets;
}

export function bucketIndex(date: Date, filters: AnalyticsFilters) {
  const step = filters.grain === "hour" ? 60 * 60 * 1000 : DAY_MS;
  return Math.floor((date.getTime() - filters.start.getTime()) / step);
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
  for (const bucket of data.buckets) for (const [metric, value, state] of [["report intake", bucket.reports, data.sources.reports], ["visible reports", bucket.visibleReports, data.sources.reports], ["distinct incidents", bucket.incidents, data.sources.incidents]] as const) add("bucket", bucket.label, metric, value, state);
  for (const item of data.severity ?? []) add("severity", period, item.label, item.count, data.sources.reports);
  add("snapshot", data.asOf, "verification backlog", data.snapshots.verificationBacklog, data.sources.reports === "complete" ? "snapshot" : data.sources.reports);
  add("snapshot", data.asOf, "oldest unreviewed minutes", data.snapshots.oldestUnreviewedMinutes, data.sources.reports === "complete" ? "snapshot" : data.sources.reports);
  add("snapshot", data.asOf, "active incidents", data.snapshots.activeIncidents, data.sources.incidents === "complete" ? "snapshot" : data.sources.incidents);
  add("snapshot", data.asOf, "shelter occupancy", null, "unavailable");
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}
