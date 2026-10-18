"use client";

import { useCallback, useEffect, useState } from "react";
import { BULACAN_LOCALITIES } from "@/data/bulacan-localities";
import { parseAnalyticsFilters, type AnalyticsData, type SourceState } from "@/lib/admin-analytics-policy";

const initial = parseAnalyticsFilters(new URLSearchParams());
const series = [
  { key: "reports", label: "Reports received", color: "bg-blue-500" },
  { key: "incidents", label: "Distinct incidents", color: "bg-amber-500" },
  { key: "rescues", label: "Rescue requests", color: "bg-red-500" },
] as const;

function display(value: number | null) { return value === null ? "Unavailable" : value.toLocaleString("en-PH"); }
function stateLabel(state: SourceState) { return state === "locality_unavailable" ? "Locality not recorded for this source" : state === "unavailable" ? "Source unavailable or too large for this view" : ""; }

function VolumeChart({ data }: { data: AnalyticsData }) {
  const [activeBucketIndex, setActiveBucketIndex] = useState<number | null>(null);
  const activeBucket = activeBucketIndex === null ? null : data.buckets[activeBucketIndex];
  const max = Math.max(1, ...data.buckets.flatMap((bucket) => series.map((item) => bucket[item.key] ?? 0)));
  const zero = data.buckets.every((bucket) => series.every((item) => !bucket[item.key]));
  return <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6" aria-label="Operational volume chart">
    <h3 className="text-lg font-semibold">Operational volume</h3>
    <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">Created within the selected Manila-time dates. Incidents count once, not once per report.</p>
    <div className="mt-3 flex flex-wrap gap-4 text-xs">{series.map((item) => <span key={item.key} className="flex items-center gap-2"><span className={`h-3 w-3 rounded-sm ${item.color}`} />{item.label}</span>)}</div>
    {zero ? <p className="mt-5 text-sm">No recorded volume in this range, or selected sources are unavailable.</p> : <div className="relative mt-5"><div className="overflow-x-auto pb-3"><div className="min-w-max">
      <div className="flex justify-between text-xs text-[var(--color-muted-foreground)]"><span>0</span><span>Scale: {max}</span></div>
      <div className="mt-1 flex h-48 items-end gap-2 border-b border-[var(--color-border)]">{data.buckets.map((bucket, index) => <div key={bucket.start} className="flex h-full min-w-12 flex-1 items-end justify-center gap-0.5" onMouseEnter={() => setActiveBucketIndex(index)} onMouseLeave={() => setActiveBucketIndex(null)}>
        {series.map((item) => <button key={item.key} type="button" disabled={bucket[item.key] === null} onFocus={() => setActiveBucketIndex(index)} onBlur={() => setActiveBucketIndex(null)} aria-label={`${bucket.label}: ${item.label} ${display(bucket[item.key])}`} className={`min-h-0 w-3 rounded-t focus-visible:outline-2 focus-visible:outline-offset-2 ${item.color} disabled:opacity-25`} style={{ height: `${Math.max(bucket[item.key] ? 4 : 0, (bucket[item.key] ?? 0) / max * 100)}%` }} />)}
      </div>)}</div>
      <div className="mt-2 flex gap-2">{data.buckets.map((bucket) => <span key={bucket.start} className="min-w-12 flex-1 text-center text-[10px] text-[var(--color-muted-foreground)]">{bucket.label.slice(5)}</span>)}</div>
    </div></div>{activeBucket && <div data-testid="volume-tooltip" className="pointer-events-none absolute right-2 top-2 z-10 max-w-[calc(100%-1rem)] rounded-lg bg-slate-950 p-3 text-xs text-white shadow-xl">{activeBucket.label}{series.map((item) => <div key={item.key}>{item.label}: {display(activeBucket[item.key])}</div>)}</div>}</div>}
  </section>;
}

function CountBars({ title, items }: { title: string; items: { label: string; count: number }[] | null }) {
  if (items === null) return <section className="rounded-xl border border-[var(--color-border)] p-5"><h3 className="font-semibold">{title}</h3><p className="mt-3 text-sm">Unavailable for these filters.</p></section>;
  const max = Math.max(1, ...items.map((item) => item.count));
  return <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"><h3 className="font-semibold">{title}</h3>{items.length === 0 ? <p className="mt-3 text-sm">No matching records.</p> : <ul className="mt-4 space-y-3">{items.map((item) => <li key={item.label}><div className="flex justify-between gap-3 text-sm"><span>{item.label}</span><strong>{item.count}</strong></div><div className="mt-1 h-2 overflow-hidden rounded bg-[var(--color-panel)]"><div className="h-full bg-blue-500" style={{ width: `${item.count / max * 100}%` }} /></div></li>)}</ul>}</section>;
}

export function AdminAnalytics() {
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [grain, setGrain] = useState<"day" | "hour">("day");
  const [localityId, setLocalityId] = useState("");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const query = new URLSearchParams({ from, to, grain, localityId }).toString();
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/analytics?${query}`, { cache: "no-store", signal });
      const body = await response.json() as { data?: AnalyticsData; error?: string };
      if (!response.ok || !body.data) throw new Error(body.error || "Could not load analytics.");
      setData(body.data); setError("");
    } catch (cause) {
      if (signal?.aborted) return;
      setError(cause instanceof Error ? cause.message : "Could not load analytics.");
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [query]);
  useEffect(() => { const controller = new AbortController(); const timer = window.setTimeout(() => void load(controller.signal), 0); return () => { window.clearTimeout(timer); controller.abort(); }; }, [load]);
  const sourceIssues = data ? Object.entries(data.sources).filter(([, state]) => state !== "complete") : [];
  const filtersMatch = Boolean(data && data.filters.from === from && data.filters.to === to && data.filters.grain === grain && data.filters.localityId === localityId);
  const exportHref = `/api/admin/analytics/export?${query}`;
  return <div className="space-y-5">
    <header><p className="text-xs font-bold tracking-[.14em] text-[var(--color-primary)]">BULACAN OPERATIONS</p><h2 className="mt-1 text-3xl font-bold">Operational analytics</h2><p className="mt-2 text-sm text-[var(--color-muted-foreground)]">Real database records. Counts describe recorded activity, not confirmed field conditions.</p></header>
    <div className="grid gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:grid-cols-2 lg:grid-cols-5">
      <label className="text-sm">From (Manila date)<input aria-label="Analytics from date" type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-2" /></label>
      <label className="text-sm">To (Manila date)<input aria-label="Analytics to date" type="date" value={to} onChange={(event) => setTo(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-2" /></label>
      <label className="text-sm">Chart interval<select aria-label="Analytics interval" value={grain} onChange={(event) => setGrain(event.target.value as "day" | "hour")} className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-2"><option value="day">Daily</option><option value="hour">Hourly (up to 2 days)</option></select></label>
      <label className="text-sm">Municipality<select aria-label="Analytics municipality" value={localityId} onChange={(event) => setLocalityId(event.target.value)} className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-2"><option value="">All Bulacan</option>{BULACAN_LOCALITIES.map((place) => <option key={place.code} value={place.code}>{place.name}</option>)}</select></label>
      <div className="flex items-end gap-2"><a href={exportHref} aria-disabled={!filtersMatch || loading || Boolean(error)} onClick={(event) => { if (!filtersMatch || loading || error) event.preventDefault(); }} className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm underline aria-disabled:opacity-50">Download matching CSV</a></div>
    </div>
    {error && <p role="alert" className="rounded-lg border border-[var(--color-danger-border)] p-3 text-sm">{error} {data && "Previous results remain visible."} <button type="button" onClick={() => void load()} className="underline">Retry</button></p>}
    {loading && <p role="status" className="text-sm">Loading current records…</p>}
    {data && <>
      <p className="text-xs text-[var(--color-muted-foreground)]">Showing {data.filters.from} to {data.filters.to}{data.filters.localityId ? ` · ${BULACAN_LOCALITIES.find((place) => place.code === data.filters.localityId)?.name ?? "selected municipality"}` : " · all Bulacan"}. Data checked {new Date(data.asOf).toLocaleString("en-PH", { timeZone: "Asia/Manila" })} (Manila time). Range counts use creation dates; current-state cards are snapshots.</p>
      {sourceIssues.length > 0 && <div role="status" className="rounded-lg border border-[var(--color-warning-border)] p-3 text-sm">Partial data: {sourceIssues.map(([name, state]) => `${name}: ${stateLabel(state)}`).join("; ")}. Unavailable values are never shown as zero.</div>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
        ["Reports received", data.totals.reportIntake, "Range · includes all intake"],
        ["Visible reports", data.totals.visibleReports, "Range · excludes rejected and archived"],
        ["Distinct incidents", data.totals.incidents, "Range · one per incident"],
        ["Rescue requests", data.totals.rescues, `Range · ${data.totals.cancelledRescues ?? "—"} cancelled, ${data.totals.rejectedRescues ?? "—"} rejected`],
      ].map(([label, value, detail]) => <section key={label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"><h3 className="text-sm font-semibold">{label}</h3><p className="mt-2 text-3xl font-bold tabular-nums">{display(value as number | null)}</p><p className="mt-2 text-xs text-[var(--color-muted-foreground)]">{detail}</p></section>)}</div>
      <VolumeChart data={data} />
      <div className="grid gap-4 lg:grid-cols-2"><CountBars title="Visible reports by severity" items={data.severity} /><CountBars title="Rescue requests by municipality" items={data.geography?.map((item) => ({ label: item.label, count: item.rescues })) ?? null} /></div>
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"><h3 className="font-semibold">Current-state snapshot</h3><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
        ["Verification backlog", data.snapshots.verificationBacklog], ["Oldest pending review (minutes)", data.snapshots.oldestUnreviewedMinutes],
        ["Active incidents", data.snapshots.activeIncidents], ["Critical rescue requests", data.snapshots.criticalRescues],
      ].map(([label, value]) => <div key={label}><p className="text-sm">{label}</p><strong className="text-xl">{display(value as number | null)}</strong></div>)}</div><p className="mt-4 text-sm">Shelter occupancy: Unavailable. Capacity is not a live headcount.</p></section>
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"><h3 className="font-semibold">Recorded response intervals</h3><p className="mt-1 text-sm text-[var(--color-muted-foreground)]">From request receipt to the first recorded event of each type. Missing stages are excluded; no response time is inferred.</p>{data.responseTimes ? <div className="mt-3 grid gap-3 sm:grid-cols-3">{data.responseTimes.map((item) => <div key={item.stage} className="rounded-lg border border-[var(--color-border)] p-3"><h4 className="font-semibold capitalize">{item.stage}</h4><p className="text-sm">Samples: {item.sampleSize}</p><p className="text-sm">Median: {item.medianMinutes === null ? "—" : `${item.medianMinutes} min`}</p><p className="text-sm">90th percentile: {item.p90Minutes === null ? "—" : `${item.p90Minutes} min`}</p></div>)}</div> : <p className="mt-3 text-sm">Unavailable for these filters.</p>}</section>
    </>}
  </div>;
}
