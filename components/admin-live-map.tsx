"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, RefreshCw, Search } from "lucide-react";
import { AdminOperationsMap } from "@/components/admin-operations-map";
import { useAdminOperations } from "@/components/use-admin-operations";
import { centerOpeningLabel, formatOperationalUpdate } from "@/lib/emergency-resources";
import { formatUiLabel } from "@/lib/ui-labels";

const field = "h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-3 text-sm";

export function AdminLiveMap() {
  const { data, loading, refreshing, error, refresh } = useAdminOperations();
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [showReports, setShowReports] = useState(true);
  const [showCenters, setShowCenters] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const query = search.trim().toLocaleLowerCase("en-PH");

  const visible = useMemo(() => {
    const reports = (data?.reports ?? []).filter((report) => showReports && type !== "center" &&
      (status === "all" || status === `report:${report.verificationStatus}`) &&
      (!query || [report.id, report.title, report.description, report.locationName].some((part) => part.toLocaleLowerCase("en-PH").includes(query))));
    const centers = (data?.centers ?? []).filter((center) => showCenters && type !== "report" &&
      (status === "all" || status === `center:${center.openingStatus}`) &&
      (!query || [center.id, center.name, center.address, center.barangay ?? "", center.city].some((part) => part.toLocaleLowerCase("en-PH").includes(query))));
    return { reports, centers };
  }, [data, query, type, status, showReports, showCenters]);

  const list = [
    ...visible.reports.map((record) => ({ kind: "report" as const, record, mapped: record.latitude !== null && record.longitude !== null })),
    ...visible.centers.map((record) => ({ kind: "center" as const, record, mapped: record.latitude !== null && record.longitude !== null })),
  ].sort((a, b) => Number(b.mapped) - Number(a.mapped));
  const mappedReports = visible.reports.filter((report) => report.latitude !== null && report.longitude !== null);
  const mappedCenters = visible.centers.filter((center) => center.latitude !== null && center.longitude !== null);

  function reset() { setSearch(""); setType("all"); setStatus("all"); setShowReports(true); setShowCenters(true); setSelectedId(null); }

  return <div className="space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold tracking-[.18em] text-[var(--color-primary)]">BULACAN OPERATIONS</p><h2 className="mt-2 text-3xl font-bold tracking-tight">Live Operations Map</h2><p className="mt-2 text-sm text-[var(--color-muted-foreground)]">Explore recorded flood reports and evacuation centers. Verification and opening status are shown separately.</p></div><button type="button" onClick={() => void refresh()} disabled={refreshing} className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 text-sm disabled:opacity-50"><RefreshCw className="h-4 w-4" />Refresh records</button></header>
    <p className="text-xs text-[var(--color-muted-foreground)]">{data ? `Records checked ${formatOperationalUpdate(data.fetchedAt)} · refreshes every minute` : loading ? "Loading operational records…" : "Operational records unavailable"}</p>
    {error ? <p role="alert" className="rounded-lg border border-[var(--color-border)] p-4 text-sm text-[var(--color-danger)]">{error}</p> : null}
    <button type="button" aria-expanded={panelOpen} aria-controls="operations-record-panel" onClick={() => setPanelOpen((value) => !value)} className="flex w-full items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm font-semibold lg:hidden">Records and filters <ChevronDown className={`h-4 w-4 transition-transform ${panelOpen ? "rotate-180" : ""}`} /></button>
    <div className="grid min-h-[620px] gap-4 lg:h-[min(760px,calc(100vh-210px))] lg:grid-cols-[330px_minmax(0,1fr)]">
      <aside id="operations-record-panel" className={`${panelOpen ? "block" : "hidden"} min-h-0 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] lg:block`}>
        <div className="space-y-3 border-b border-[var(--color-border)] p-4">
          <label className="block text-xs font-semibold">Search records<span className="mt-1 flex h-10 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-3"><Search className="h-4 w-4 shrink-0" aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ID, place, description, center" className="h-full min-w-0 flex-1 bg-transparent text-sm font-normal outline-none" /></span></label>
          <div className="grid grid-cols-2 gap-2"><label className="text-xs font-semibold">Record type<select value={type} onChange={(event) => setType(event.target.value)} className={`mt-1 ${field}`}><option value="all">All types</option><option value="report">Flood reports</option><option value="center">Evacuation centers</option></select></label><label className="text-xs font-semibold">Status<select value={status} onChange={(event) => setStatus(event.target.value)} className={`mt-1 ${field}`}><option value="all">All statuses</option><option value="report:unreviewed">Unreviewed report</option><option value="report:verified">Verified report</option><option value="report:disputed">Disputed report</option><option value="report:rejected">Rejected report</option><option value="center:open">Confirmed open center</option><option value="center:unknown">Unconfirmed center</option><option value="center:closed">Closed center</option></select></label></div>
          <fieldset><legend className="text-xs font-semibold">Map layers</legend><div className="mt-2 flex flex-wrap gap-4 text-xs"><label className="flex items-center gap-2"><input type="checkbox" checked={showReports} onChange={(event) => setShowReports(event.target.checked)} />Flood reports</label><label className="flex items-center gap-2"><input type="checkbox" checked={showCenters} onChange={(event) => setShowCenters(event.target.checked)} />Evacuation centers</label></div><p className="mt-2 text-xs text-[var(--color-muted-foreground)]">Affected-area boundaries unavailable; no validated flood polygons are recorded.</p></fieldset>
          <button type="button" onClick={reset} className="text-xs font-semibold text-[var(--color-primary)] hover:underline">Reset filters</button>
        </div>
        <div className="px-4 py-3 text-xs text-[var(--color-muted-foreground)]">{list.length} matching records · {mappedReports.length + mappedCenters.length} mapped{data?.limits.reportsTruncated || data?.limits.centersTruncated ? " · showing the 500 most recent records of each type" : ""}</div>
        <div className="divide-y divide-[var(--color-border)]">{list.length ? list.map((item) => {
          const key = `${item.kind}:${item.record.id}`;
          const title = item.kind === "report" ? item.record.title : item.record.name;
          const place = item.kind === "report" ? item.record.locationName : `${item.record.barangay ? `${item.record.barangay}, ` : ""}${item.record.city}`;
          const label = item.kind === "report" ? `${item.record.severity} · ${formatUiLabel(item.record.verificationStatus)}` : `${centerOpeningLabel(item.record)} · ${formatUiLabel(item.record.verificationStatus)}`;
          return <div key={key} className={`px-4 py-3 ${selectedId === key ? "bg-[var(--color-primary-soft)]" : ""}`}><button type="button" onClick={() => { if (item.mapped) { setSelectedId(key); setPanelOpen(false); } }} disabled={!item.mapped} className="w-full text-left disabled:cursor-default"><span className="text-xs text-[var(--color-muted-foreground)]">{item.kind === "report" ? `Report #${item.record.id.slice(0, 8)}` : "Evacuation center"}</span><span className="mt-1 block text-sm font-semibold">{title}</span><span className="mt-1 block text-xs text-[var(--color-muted-foreground)]">{place}</span><span className="mt-1 block text-xs">{label}</span>{!item.mapped ? <span className="mt-1 block text-xs text-[var(--color-warning)]">Exact map location unavailable.</span> : null}</button><Link href={item.kind === "report" ? `/admin/reports/${item.record.id}` : `/admin/data/${item.record.id}`} className="mt-2 inline-block text-xs font-semibold text-[var(--color-primary)] hover:underline">{item.kind === "report" ? "Review report" : "View center"}</Link></div>;
        }) : <p className="p-5 text-sm text-[var(--color-muted-foreground)]">{loading ? "Loading records…" : "No records match these filters."}</p>}</div>
      </aside>
      <section aria-label="Bulacan operations map" className="h-[65vh] min-h-[420px] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-map-shell)] lg:h-full">{data ? <AdminOperationsMap reports={mappedReports} centers={mappedCenters} selectedId={selectedId} /> : <div className="grid h-full place-items-center text-sm text-[var(--color-muted-foreground)]">{loading ? "Loading Bulacan map…" : "Map unavailable"}</div>}</section>
    </div>
  </div>;
}
