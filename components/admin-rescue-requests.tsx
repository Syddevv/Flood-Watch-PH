"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminCreateRescueModal } from "@/components/admin-create-rescue-modal";
import type { CreatedRescue } from "@/components/admin-rescue-intake-form";

type ListResponse = { data?: { requests: CreatedRescue[]; nextCursor: string | null }; error?: string };

export function AdminRescueRequests() {
  const [requests, setRequests] = useState<CreatedRescue[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const refresh = useCallback(async (cursor?: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/rescue-requests?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, { cache: "no-store" });
      const body = await response.json().catch(() => null) as ListResponse | null;
      if (!response.ok || !body?.data) throw new Error(body?.error || "Could not load rescue requests.");
      const data = body.data;
      setRequests((current) => cursor ? [...current, ...data.requests.filter((request) => !current.some((known) => known.id === request.id))] : data.requests);
      setNextCursor(data.nextCursor);
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load rescue requests."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer); }, [refresh]);
  function created(request: CreatedRescue, nearDuplicate: boolean) {
    setRequests((current) => [request, ...current.filter((item) => item.id !== request.id)]);
    setNotice(`${request.reference} recorded. This does not confirm dispatch.${nearDuplicate ? " A similar recent request may exist; review before acting." : ""}`);
    void refresh();
  }
  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold tracking-[.18em] text-[var(--color-primary)]">BULACAN RESCUE INTAKE</p><h2 className="mt-2 text-3xl font-bold tracking-tight">Rescue requests</h2><p className="mt-2 text-sm text-[var(--color-muted-foreground)]">Record assisted requests. Triage and dispatch operations are not connected here yet.</p></div><AdminCreateRescueModal onCreated={created} /></header>
    {notice && <p role="status" className="rounded-lg border border-[var(--color-success-border)] bg-[var(--color-success-surface)] p-4 text-sm">{notice}</p>}
    {error && <p role="alert" className="rounded-lg border border-[var(--color-danger-border)] p-4 text-sm">{error} <button type="button" onClick={() => void refresh()} className="underline">Retry</button></p>}
    <section aria-label="Recent rescue requests" className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]"><div className="border-b border-[var(--color-border)] p-4 sm:p-5"><h3 className="text-lg font-semibold">Recent requests</h3><p className="text-sm text-[var(--color-muted-foreground)]">Live records. A4 will add the operational queue and actions.</p></div>
      {loading && requests.length === 0 && <p className="p-5 text-sm">Loading requests…</p>}
      {!loading && !error && requests.length === 0 && <p className="p-5 text-sm">No rescue requests recorded.</p>}
      <ul>{requests.map((request) => <li key={request.id} className="grid gap-2 border-b border-[var(--color-border)] p-4 text-sm last:border-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:p-5"><div><p className="font-mono font-semibold">{request.reference}</p><p className="mt-1">{request.locationName}, {request.barangay}</p><p className="mt-1 text-[var(--color-muted-foreground)]">{new Date(request.createdAt).toLocaleString("en-PH")}</p></div><div className="sm:text-right"><p className="capitalize">{request.priority} priority</p><p className="text-[var(--color-muted-foreground)]">{request.status.replaceAll("_", " ")}</p></div></li>)}</ul>
      {nextCursor && <div className="border-t border-[var(--color-border)] p-4"><button type="button" disabled={loading} onClick={() => void refresh(nextCursor)} className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm disabled:opacity-50">{loading ? "Loading…" : "Load more"}</button></div>}
    </section>
    <p className="text-sm"><Link href="/admin/rescue-requests/new" className="underline">Open the direct new-request page</Link></p>
  </div>;
}
