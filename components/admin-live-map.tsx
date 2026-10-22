"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, RefreshCw, Search } from "lucide-react";
import { AdminOperationsMap } from "@/components/admin-operations-map";
import { useAdminOperations } from "@/components/use-admin-operations";
import { compactBulacanPlace, isRecentMonitoringReport, relativeOperationalTime } from "@/lib/admin-operations-policy";
import { centerOpeningLabel, formatOperationalUpdate } from "@/lib/emergency-resources";
import { formatUiLabel } from "@/lib/ui-labels";

type ReportView = "recent" | "pending" | "verified" | "all";
const field = "mt-1 h-10 w-full min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-3 pr-8 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]";

export function AdminLiveMap() {
  const { data, loading, refreshing, error, refresh } = useAdminOperations();
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"all" | "report" | "center">("all");
  const [status, setStatus] = useState("all");
  const [view, setView] = useState<ReportView>("recent");
  const [showReports, setShowReports] = useState(true);
  const [showCenters, setShowCenters] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const query = search.trim().toLocaleLowerCase("en-PH");
  const now = data ? Date.parse(data.fetchedAt) : 0;
  const recentReportWindowMs = (data?.recentReportHours ?? 72) * 3_600_000;

  const visible = useMemo(() => {
    const reports = (data?.reports ?? []).filter((report) => {
      if (!showReports || type === "center") return false;
      const recent = isRecentMonitoringReport(report, now, recentReportWindowMs);
      if (view !== "all" && !recent) return false;
      if (view === "pending" && report.verificationStatus !== "unreviewed") return false;
      if (view === "verified" && report.verificationStatus !== "verified") return false;
      if (status !== "all" && status !== `report:${report.verificationStatus}`) return false;
      return !query || [report.id, report.title, report.description, report.locationName].some((part) => part.toLocaleLowerCase("en-PH").includes(query));
    });
    const centers = (data?.centers ?? []).filter((center) => showCenters && type !== "report" &&
      (status === "all" || status === `center:${center.openingStatus}`) &&
      (!query || [center.id, center.name, center.address, center.barangay ?? "", center.city].some((part) => part.toLocaleLowerCase("en-PH").includes(query))));
    return { reports, centers };
  }, [data, now, recentReportWindowMs, query, type, status, view, showReports, showCenters]);

  const list = [
    ...visible.reports.map((record) => ({ kind: "report" as const, record, mapped: record.latitude !== null && record.longitude !== null, updatedAt: record.createdAt })),
    ...visible.centers.map((record) => ({ kind: "center" as const, record, mapped: record.latitude !== null && record.longitude !== null, updatedAt: record.updatedAt })),
  ].sort((a, b) => Number(b.mapped) - Number(a.mapped) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const mappedReports = visible.reports.filter((report) => report.latitude !== null && report.longitude !== null);
  const mappedCenters = visible.centers.filter((center) => center.latitude !== null && center.longitude !== null);
  const activeSelection = list.some((item) => `${item.kind}:${item.record.id}` === selectedId) ? selectedId : null;

  function chooseView(next: ReportView) { setView(next); setType(next === "pending" || next === "verified" ? "report" : "all"); setStatus("all"); setSelectedId(null); }
  function reset() { setSearch(""); setType("all"); setStatus("all"); setView("recent"); setShowReports(true); setShowCenters(true); setSelectedId(null); }

  return <div className="space-y-4">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold tracking-[.18em] text-[var(--color-primary)]">BULACAN OPERATIONS</p><h2 className="mt-2 text-3xl font-bold tracking-tight">Live Operations Map</h2><p className="mt-1 text-sm text-[var(--color-muted-foreground)]">Recent reports and registered evacuation centers. Older reports are available in Historical view.</p></div><button type="button" onClick={() => void refresh()} disabled={refreshing} className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 text-sm disabled:opacity-50"><RefreshCw className="h-4 w-4" />Refresh records</button></header>
    <p className="text-xs text-[var(--color-muted-foreground)]">{data ? `Updated ${formatOperationalUpdate(data.fetchedAt)} · refreshes every minute` : loading ? "Loading operational records…" : "Operational records unavailable"}</p>
    {error ? <p role="alert" className="rounded-lg border border-[var(--color-border)] p-4 text-sm text-[var(--color-danger)]">{error}</p> : null}
    <button type="button" aria-expanded={panelOpen} aria-controls="operations-record-panel" onClick={() => setPanelOpen((value) => !value)} className="flex w-full items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm font-semibold lg:hidden">Map Records and filters <ChevronDown className={`h-4 w-4 transition-transform ${panelOpen ? "rotate-180" : ""}`} /></button>
    <div className="grid min-w-0 gap-4 lg:h-[min(740px,calc(100dvh-215px))] lg:min-h-[540px] lg:grid-cols-[minmax(360px,32%)_minmax(0,1fr)]">
      <aside id="operations-record-panel" className={`${panelOpen ? "flex" : "hidden"} order-2 max-h-[70dvh] min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] lg:order-1 lg:flex lg:max-h-none`}>
        <div className="shrink-0 border-b border-[var(--color-border)] p-4">
          <div className="flex items-baseline justify-between gap-2"><h3 className="font-semibold">Map Records</h3><span className="text-xs text-[var(--color-muted-foreground)]">{list.length} visible · {mappedReports.length + mappedCenters.length} mapped</span></div>
          <div className="mt-3 flex flex-wrap gap-1" aria-label="Report quick filters">{(["recent", "pending", "verified", "all"] as const).map((option) => <button key={option} type="button" aria-pressed={view === option} onClick={() => chooseView(option)} className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${view === option ? "bg-[var(--color-primary)] text-white" : "bg-[var(--color-panel)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"}`}>{option === "all" ? "All / Historical" : option.charAt(0).toUpperCase() + option.slice(1)}</button>)}</div>
          <label className="mt-3 block text-xs font-semibold">Search<span className="mt-1 flex h-10 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-3 focus-within:ring-2 focus-within:ring-[var(--color-primary)]"><Search className="h-4 w-4 shrink-0" aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Report, place, or center" className="h-full min-w-0 flex-1 bg-transparent text-sm font-normal outline-none" /></span></label>
          <div className="mt-3 grid grid-cols-2 gap-2"><label className="min-w-0 text-xs font-semibold">Record type<select value={type} onChange={(event) => { const next = event.target.value as typeof type; setType(next); setStatus("all"); if (next !== "report" && (view === "pending" || view === "verified")) setView("recent"); }} className={field}><option value="all">All types</option><option value="report">Flood reports</option><option value="center">Evacuation centers</option></select></label><label className="min-w-0 text-xs font-semibold">Status<select value={status} onChange={(event) => { setStatus(event.target.value); if (view === "pending" || view === "verified") setView("recent"); }} className={field}><option value="all">All statuses</option>{type !== "center" ? <><option value="report:unreviewed">Pending review</option><option value="report:verified">Verified</option><option value="report:disputed">Disputed</option></> : null}{type !== "report" ? <><option value="center:open">Confirmed open</option><option value="center:unknown">Unconfirmed</option><option value="center:closed">Closed</option></> : null}</select></label></div>
          <fieldset className="mt-3"><legend className="text-xs font-semibold">Map layers</legend><div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-2 text-xs"><label className="flex items-center gap-2"><input type="checkbox" checked={showReports} onChange={(event) => setShowReports(event.target.checked)} />Flood reports</label><label className="flex items-center gap-2"><input type="checkbox" checked={showCenters} onChange={(event) => setShowCenters(event.target.checked)} />Evacuation centers</label></div></fieldset>
          <div className="mt-3 flex items-center justify-between gap-2"><button type="button" onClick={reset} className="text-xs font-semibold text-[var(--color-primary)] hover:underline">Reset filters</button>{data?.limits.reportsTruncated || data?.limits.centersTruncated ? <span className="text-right text-xs text-[var(--color-muted-foreground)]">Showing up to 500 per type</span> : null}</div>
        </div>
        <div className="min-h-0 flex-1 divide-y divide-[var(--color-border)] overflow-y-auto">{list.length ? list.map((item) => {
          const key = `${item.kind}:${item.record.id}`;
          const title = item.kind === "report" ? item.record.title : item.record.name;
          const place = item.kind === "report" ? compactBulacanPlace(item.record.locationName) : `${item.record.barangay ? `${item.record.barangay}, ` : ""}${item.record.city}`;
          const report = item.kind === "report" ? item.record : null;
          const label = item.kind === "report" ? formatUiLabel(item.record.verificationStatus === "unreviewed" ? "pending_review" : item.record.verificationStatus) : centerOpeningLabel(item.record);
          const historical = report && !isRecentMonitoringReport(report, now, recentReportWindowMs);
          return <div key={key} className={`px-4 py-3 transition-colors ${activeSelection === key ? "bg-[var(--color-primary-soft)]" : "hover:bg-[var(--color-panel)]"}`}><button type="button" onClick={() => { if (item.mapped) { setSelectedId(key); setPanelOpen(false); if (window.matchMedia("(max-width: 1023px)").matches) window.requestAnimationFrame(() => document.getElementById("operations-map")?.scrollIntoView({ behavior: "smooth", block: "start" })); } }} disabled={!item.mapped} className="w-full min-w-0 text-left disabled:cursor-default"><span className="block truncate text-sm font-semibold" title={title}>{title}</span><span className="mt-1 block truncate text-xs text-[var(--color-muted-foreground)]">{place}</span><span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs"><span className={report?.severity === "Critical" || report?.severity === "High" ? "font-semibold text-[var(--color-high)]" : "font-medium"}>{report ? report.severity : "Center"}</span><span>{historical ? "Historical" : label}</span><time dateTime={item.updatedAt} title={formatOperationalUpdate(item.updatedAt)} className="text-[var(--color-muted-foreground)]">{relativeOperationalTime(item.updatedAt, now)}</time></span>{!item.mapped ? <span className="mt-1 block text-xs text-[var(--color-muted-foreground)]">Map location unavailable</span> : null}</button>{!item.mapped ? <Link href={report ? `/admin/reports/${report.id}` : `/admin/data/${item.record.id}`} className="mt-1 inline-block text-xs font-semibold text-[var(--color-primary)] hover:underline">View record</Link> : null}</div>;
        }) : <p className="p-5 text-sm text-[var(--color-muted-foreground)]">{loading ? "Loading records…" : view === "recent" ? "No recent reports or matching centers. Select All / Historical to review older reports." : "No records match these filters."}</p>}</div>
      </aside>
      <section id="operations-map" aria-label="Bulacan operations map" className="order-1 h-[62dvh] min-h-[420px] min-w-0 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-map-shell)] lg:order-2 lg:h-full">{data ? <AdminOperationsMap reports={mappedReports} centers={mappedCenters} selectedId={activeSelection} onSelectId={setSelectedId} asOf={now} recentReportWindowMs={recentReportWindowMs} /> : <div className="grid h-full place-items-center text-sm text-[var(--color-muted-foreground)]">{loading ? "Loading Bulacan map…" : "Map unavailable"}</div>}</section>
    </div>
  </div>;
}
