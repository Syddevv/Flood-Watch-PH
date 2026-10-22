"use client";

import Link from "next/link";
import { RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { BULACAN_LOCALITIES } from "@/data/bulacan-localities";
import { formatUiLabel } from "@/lib/ui-labels";

type Report = {
  id: string; title: string; locationName: string; severity: string; publicStatus: string;
  verificationStatus: string; reporter: { fullName: string | null; email: string } | null;
  createdAt: string; lastActivityAt: string; incidentReportCount: number;
  evidence: { hasPhoto: boolean; onsiteEligible: boolean; hasGpsFix: boolean; communityConfirmations: number };
};
type Payload = {
  reports: Report[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  summary: { activeCount: number; needsReviewCount: number; highSeverityCount: number; photoCount: number; activeIncidentCount: number };
};

const fieldClass = "h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-3 text-sm";

export function AdminFloodReports() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [search, setSearch] = useState("");
  const [verificationStatus, setVerificationStatus] = useState("");
  const [severity, setSeverity] = useState("");
  const [localityCode, setLocalityCode] = useState("");
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), limit: "20", sort, order });
    if (search.trim()) params.set("search", search.trim());
    if (verificationStatus) params.set("verificationStatus", verificationStatus);
    if (severity) params.set("severity", severity);
    if (localityCode) params.set("localityCode", localityCode);
    try {
      const response = await fetch(`/api/admin/reports?${params}`, { cache: "no-store", signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to load reports.");
      if (!signal?.aborted) setPayload(body.data);
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Unable to load reports.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [page, search, verificationStatus, severity, localityCode, sort, order]);
  // Fetch starts the external request; state updates finish after the network boundary.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  const change = (setter: (value: string) => void, value: string) => { setPage(1); setter(value); };
  const summary = payload?.summary;
  const totalPages = payload?.pagination.totalPages ?? 1;

  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-xs font-bold tracking-[.18em] text-[var(--color-primary)]">BULACAN OPERATIONS</p><h2 className="mt-2 text-3xl font-bold">Flood Reports</h2><p className="mt-2 text-sm text-[var(--color-muted-foreground)]">Community confirmation, admin verification, and operational status are separate decisions.</p></div>
      <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm disabled:opacity-50"><RefreshCw className="h-4 w-4" />Refresh</button>
    </header>
    <div className="grid gap-3 sm:grid-cols-3">
      {[["Active reports", summary?.activeCount], ["High or critical", summary?.highSeverityCount], ["Awaiting verification", summary?.needsReviewCount]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"><p className="text-sm text-[var(--color-muted-foreground)]">{label}</p><p className="mt-2 text-2xl font-bold">{value ?? "—"}</p></div>)}
    </div>
    <section className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="grid gap-3 border-b border-[var(--color-border)] p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-1 text-xs">Search<span className="flex h-10 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-3"><Search className="h-4 w-4 shrink-0" aria-hidden="true" /><input value={search} onChange={(event) => change(setSearch, event.target.value)} placeholder="Search reports" className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none" /></span></label>
        <label className="grid gap-1 text-xs">Verification<select value={verificationStatus} onChange={(event) => change(setVerificationStatus, event.target.value)} className={fieldClass}><option value="">All</option><option value="unreviewed">Unreviewed</option><option value="disputed">Disputed</option><option value="verified">Verified</option><option value="rejected">Rejected</option></select></label>
        <label className="grid gap-1 text-xs">Severity<select value={severity} onChange={(event) => change(setSeverity, event.target.value)} className={fieldClass}><option value="">All</option>{["Low", "Moderate", "High", "Critical"].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="grid gap-1 text-xs">Municipality in place text<select value={localityCode} onChange={(event) => change(setLocalityCode, event.target.value)} className={fieldClass}><option value="">All</option>{BULACAN_LOCALITIES.map((entry) => <option key={entry.code} value={entry.code}>{entry.name}</option>)}</select></label>
        <label className="grid gap-1 text-xs">Sort by<select value={sort} onChange={(event) => change(setSort, event.target.value)} className={fieldClass}><option value="createdAt">Report age</option><option value="lastActivityAt">Last activity</option><option value="severity">Severity</option><option value="locationName">Place name</option></select></label>
        <label className="grid gap-1 text-xs">Order<select value={order} onChange={(event) => change(setOrder, event.target.value)} className={fieldClass}><option value="desc">Newest / descending</option><option value="asc">Oldest / ascending</option></select></label>
      </div>
      {localityCode ? <p className="px-4 pt-3 text-xs text-[var(--color-muted-foreground)]">Locality filter matches existing place descriptions. Reports without that name may not appear.</p> : null}
      {error ? <p role="alert" className="m-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p> : null}
      {loading ? <p className="p-8 text-sm text-[var(--color-muted-foreground)]">Loading reports...</p> : payload?.reports.length ? <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted-foreground)]"><tr>{["Report", "Reporter", "Severity", "Verification", "Evidence", "Place", "Age / updated", "Incident"].map((heading) => <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>)}</tr></thead><tbody>{payload.reports.map((report) => <tr key={report.id} className="border-b border-[var(--color-border)] last:border-0"><td className="px-4 py-3"><Link href={`/admin/reports/${report.id}`} className="font-semibold text-[var(--color-primary)] hover:underline">{report.title}</Link><p className="text-xs text-[var(--color-muted-foreground)]">{report.id.slice(0, 8)} · {report.publicStatus}</p></td><td className="px-4 py-3">{report.reporter?.fullName ?? "Reporter information unavailable"}</td><td className="px-4 py-3">{report.severity}</td><td className="px-4 py-3">{formatUiLabel(report.verificationStatus)}{report.verificationStatus === "unreviewed" ? <p className="text-xs text-amber-300">Provisional</p> : null}</td><td className="px-4 py-3 text-xs">{report.evidence.hasPhoto ? "Photo" : "No photo"} · {report.evidence.onsiteEligible ? "Onsite eligible" : "Legacy / unverified capture"}<br />{report.evidence.communityConfirmations} community confirmations</td><td className="px-4 py-3">{report.locationName}</td><td className="whitespace-nowrap px-4 py-3 text-xs"><time>{new Date(report.createdAt).toLocaleString("en-PH")}</time><br /><span className="text-[var(--color-muted-foreground)]">Updated {new Date(report.lastActivityAt).toLocaleString("en-PH")}</span></td><td className="px-4 py-3">{report.incidentReportCount} included</td></tr>)}</tbody></table></div> : <p className="p-8 text-sm text-[var(--color-muted-foreground)]">No reports match these filters.</p>}
      <div className="flex items-center justify-between border-t border-[var(--color-border)] px-4 py-3 text-xs"><span>{payload?.pagination.total ?? 0} reports</span><div className="flex gap-2"><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1 || loading} className="rounded-lg border border-[var(--color-border)] px-3 py-2 disabled:opacity-40">Previous</button><button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page >= totalPages || loading} className="rounded-lg border border-[var(--color-border)] px-3 py-2 disabled:opacity-40">Next</button></div></div>
    </section>
  </div>;
}
