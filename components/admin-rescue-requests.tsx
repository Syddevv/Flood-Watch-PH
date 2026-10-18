"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AdminCreateRescueModal } from "@/components/admin-create-rescue-modal";
import type { CreatedRescue } from "@/components/admin-rescue-intake-form";
import { BULACAN_LOCALITIES } from "@/data/bulacan-localities";
import { RESCUE_STATUSES } from "@/lib/rescue-contracts";

type QueueItem = Pick<CreatedRescue, "id" | "reference" | "status" | "priority" | "createdAt" | "localityCode" | "barangay"> & {
  updatedAt: string; caseOwnerUserId: string | null; confirmedTeamReference: string | null;
  intakeChannel: string; peopleCount: number; overdue: boolean; firstTriagedAt: string | null;
};
type Summary = { total: number; overdueCount: number; unassignedCount: number; asOf: string; attentionMinutes: number };
type ListResponse = { data?: { requests: QueueItem[]; nextCursor: string | null; summary: Summary }; error?: string };

export function AdminRescueRequests() {
  const [requests, setRequests] = useState<QueueItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [localityCode, setLocalityCode] = useState("");
  const [sort, setSort] = useState("newest");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const requestSequence = useRef(0);

  const query = new URLSearchParams({ search, status, priority, localityCode, sort });
  const queryString = query.toString();
  const refresh = useCallback(async (cursor?: string) => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    try {
      const params = new URLSearchParams(queryString);
      if (cursor) params.set("cursor", cursor);
      const response = await fetch(`/api/admin/rescue-requests?${params}`, { cache: "no-store" });
      const body = await response.json().catch(() => null) as ListResponse | null;
      if (!response.ok || !body?.data) throw new Error(body?.error || "Could not load rescue requests.");
      if (sequence !== requestSequence.current) return;
      const data = body.data;
      setRequests((current) => cursor ? [...current, ...data.requests.filter((item) => !current.some((known) => known.id === item.id))] : data.requests);
      setNextCursor(data.nextCursor);
      setSummary(data.summary);
      setError("");
    } catch (cause) { if (sequence === requestSequence.current) setError(cause instanceof Error ? cause.message : "Could not load rescue requests."); }
    finally { if (sequence === requestSequence.current) setLoading(false); }
  }, [queryString]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 150);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  function created(request: CreatedRescue, nearDuplicate: boolean) {
    setNotice(`${request.reference} recorded. This does not confirm dispatch.${nearDuplicate ? " A similar recent request may exist; review before acting." : ""}`);
    void refresh();
  }

  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold tracking-[.18em] text-[var(--color-primary)]">BULACAN RESCUE OPERATIONS</p><h2 className="mt-2 text-3xl font-bold tracking-tight">Rescue requests</h2><p className="mt-2 text-sm text-[var(--color-muted-foreground)]">Requests are recorded here. A case owner is not a dispatched responder; confirm team acknowledgment before marking en route.</p></div><AdminCreateRescueModal onCreated={created} /></header>
    {notice && <p role="status" className="rounded-lg border border-[var(--color-success-border)] p-4 text-sm">{notice}</p>}
    {error && <p role="alert" className="rounded-lg border border-[var(--color-danger-border)] p-4 text-sm">{error} Showing last loaded data. <button type="button" onClick={() => void refresh()} className="underline">Retry</button></p>}
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"><div className="text-sm text-[var(--color-muted-foreground)]">Matching requests</div><div className="mt-1 text-2xl font-semibold">{summary?.total ?? "—"}</div></div>
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"><div className="text-sm text-[var(--color-muted-foreground)]">Untriaged 15+ min</div><div className="mt-1 text-2xl font-semibold">{summary?.overdueCount ?? "—"}</div></div>
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"><div className="text-sm text-[var(--color-muted-foreground)]">Triaged, no case owner</div><div className="mt-1 text-2xl font-semibold">{summary?.unassignedCount ?? "—"}</div></div>
    </div>
    <p className="text-xs text-[var(--color-muted-foreground)]">The 15-minute flag is an internal review cue, not a promised response time. Counts are from {summary ? new Date(summary.asOf).toLocaleString("en-PH") : "the last successful refresh"}.</p>
    <div className="grid gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:grid-cols-2 xl:grid-cols-5">
      <label className="text-sm">Search reference or barangay<input value={search} onChange={(event) => setSearch(event.target.value)} maxLength={100} className="mt-1 block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-2" /></label>
      <label className="text-sm">Status<select aria-label="Rescue status filter" value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-2"><option value="">All statuses</option>{RESCUE_STATUSES.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
      <label className="text-sm">Priority<select value={priority} onChange={(event) => setPriority(event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-2"><option value="">All priorities</option>{["routine", "urgent", "critical"].map((value) => <option key={value}>{value}</option>)}</select></label>
      <label className="text-sm">City or municipality<select value={localityCode} onChange={(event) => setLocalityCode(event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-2"><option value="">All localities</option>{BULACAN_LOCALITIES.map((place) => <option key={place.code} value={place.code}>{place.name}</option>)}</select></label>
      <label className="text-sm">Sort<select value={sort} onChange={(event) => setSort(event.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-2"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="locality">Locality and age</option></select></label>
    </div>
    <div className="flex flex-wrap gap-3"><a href={`/api/admin/rescue-requests/export?${queryString}`} className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm">Export safe CSV</a><Link href="/admin/rescue-requests/new" className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm">Open direct intake page</Link><button type="button" onClick={() => void refresh()} className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm">Refresh</button></div>
    <section aria-label="Rescue queue" className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]"><h3 className="border-b border-[var(--color-border)] p-4 text-lg font-semibold">Queue</h3>
      {loading && requests.length === 0 && <p className="p-5 text-sm">Loading requests…</p>}
      {!loading && !error && requests.length === 0 && <p className="p-5 text-sm">No requests match these filters.</p>}
      <ul>{requests.map((request) => <li key={request.id} className="border-b border-[var(--color-border)] p-4 text-sm last:border-0 sm:p-5"><Link href={`/admin/rescue-requests/${request.id}`} className="block rounded-lg hover:text-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-offset-2"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-mono font-semibold">{request.reference}</span><span className="font-semibold capitalize">{request.priority} · {request.status.replaceAll("_", " ")}</span></div><p className="mt-2">{BULACAN_LOCALITIES.find((place) => place.code === request.localityCode)?.name ?? "Bulacan"} · {request.barangay} · {request.peopleCount} people</p><p className="mt-1 text-[var(--color-muted-foreground)]">Received {new Date(request.createdAt).toLocaleString("en-PH")} · {request.intakeChannel === "admin_assisted" ? "Admin assisted" : "Public"}</p><p className="mt-1 text-[var(--color-muted-foreground)]">First triage: {request.firstTriagedAt ? new Date(request.firstTriagedAt).toLocaleString("en-PH") : "Not yet"} · Case owner: {request.caseOwnerUserId ? "Assigned" : "Unassigned"} · Team: {request.confirmedTeamReference ? "Confirmed" : "Not confirmed"}</p>{request.overdue && <p className="mt-2 font-semibold text-[var(--color-warning)]">Needs triage review (15+ min)</p>}</Link></li>)}</ul>
      {nextCursor && <div className="p-4"><button type="button" disabled={loading} onClick={() => void refresh(nextCursor)} className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm disabled:opacity-50">{loading ? "Loading…" : "Load more"}</button></div>}
    </section>
  </div>;
}
