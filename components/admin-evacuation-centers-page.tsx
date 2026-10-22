"use client";

import Link from "next/link";
import { ArrowUpRight, Building2, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { currentCenterOpeningStatus, centerOpeningLabel } from "@/lib/emergency-resources";
import { useEffect, useState } from "react";

import { BULACAN_LOCALITIES } from "@/data/bulacan-localities";
import { formatUiLabel } from "@/lib/ui-labels";

function centerLocation(center: AdminCenter) {
  if (center.barangay?.trim()) return `${center.barangay.trim()}, ${center.city.replace(/^City of /i, "").trim()}`;
  const address = center.address.trim();
  const city = center.city.trim();
  return address.toLocaleLowerCase().includes(city.toLocaleLowerCase()) ? address : `${address}, ${city}`;
}

export type AdminCenter = {
  id: string; name: string; description: string | null; address: string;
  barangay: string | null; city: string; localityCode: string | null; province: string;
  latitude: number | null; longitude: number | null; contactNumber: string | null;
  facilities: string[]; status: string; verificationStatus: string;
  sourceType: string; sourceName: string | null; sourceUrl: string | null;
  notes: string | null; estimatedCapacity: number | null;
  lastVerifiedAt: string | null; availabilityConfirmedAt: string | null;
  isArchived: boolean; updatedAt: string;
  externalKey: string | null; sourceSnapshot: unknown; sourceCheckedAt: string | null;
  facilityType: string | null; permanent: boolean | null; capacityFamilies: number | null;
  adminEvidenceUrl: string | null; duplicateReviewNotes: string | null;
};

export function AdminEvacuationCentersPage() {
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [verificationStatus, setVerificationStatus] = useState("");
  const [archived, setArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [centers, setCenters] = useState<AdminCenter[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(24);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), archived: String(archived) });
    if (search.trim()) params.set("search", search.trim());
    if (city) params.set("city", city);
    if (verificationStatus) params.set("verificationStatus", verificationStatus);
    fetch(`/api/admin/evacuation-centers?${params}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Unable to load centers.");
        setCenters(payload.data.centers);
        setTotal(payload.data.total);
        setPageSize(payload.data.pageSize);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load centers.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [search, city, verificationStatus, archived, page]);

  const filterClass = "h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm";
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[.18em] text-[var(--color-primary)]">BULACAN EMERGENCY OPERATIONS</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">Evacuation Centers</h2>
          <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">Manage source verification and current availability separately.</p>
        </div>
        <div className="flex gap-3"><Link href="/admin/emergency-contacts" className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-semibold">Manage contacts</Link><Link href="/admin/data/new" className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white">Add center</Link></div>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-end">
        <label className="grid gap-1 text-xs font-medium text-[var(--color-muted-foreground)]">Search centers<input value={search} onChange={(event) => { setLoading(true); setError(null); setSearch(event.target.value); setPage(1); }} placeholder="Name or address" className={filterClass} /></label>
        <label className="grid gap-1 text-xs font-medium text-[var(--color-muted-foreground)]">Municipality or city<select value={city} onChange={(event) => { setLoading(true); setError(null); setCity(event.target.value); setPage(1); }} className={filterClass}>
          <option value="">All municipalities and cities</option>
          {BULACAN_LOCALITIES.map((locality) => <option key={locality.code} value={locality.name}>{locality.name}</option>)}
        </select></label>
        <label className="grid gap-1 text-xs font-medium text-[var(--color-muted-foreground)]">Verification<select value={verificationStatus} onChange={(event) => { setLoading(true); setError(null); setVerificationStatus(event.target.value); setPage(1); }} className={filterClass}>
          <option value="">All verification states</option>
          <option value="verified">Verified</option>
          <option value="official_publication_found">Official publication found</option>
          <option value="needs_verification">Needs verification</option>
          <option value="outdated">Outdated</option>
          <option value="disputed">Disputed</option>
        </select></label>
        <label className="flex h-10 items-center gap-2 text-sm"><input type="checkbox" checked={archived} onChange={(event) => { setLoading(true); setError(null); setArchived(event.target.checked); setPage(1); }} />Archived</label>
      </div>
      {loading ? <p role="status">Loading centers…</p> : error ? <p role="alert" className="text-[var(--color-danger)]">{error}</p> : (
        <>
          <p className="text-sm text-[var(--color-muted-foreground)]">{total} record{total === 1 ? "" : "s"}</p>
          {centers.length === 0 ? <p className="rounded-xl border border-dashed border-[var(--color-border)] p-8 text-center">No centers match these filters.</p> : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {centers.map((center) => {
                const openingStatus = currentCenterOpeningStatus(center.status, center.availabilityConfirmedAt);
                return <article key={center.id} className="flex min-w-0 flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                  <div className="flex min-w-0 gap-3 pb-4">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--color-panel)] text-[var(--color-foreground)]"><Building2 aria-hidden="true" className="h-5 w-5" /></span>
                    <div className="min-w-0">
                      <h3 className="font-semibold leading-snug">{center.name}</h3>
                      <p className="mt-2 flex items-start gap-1 text-xs text-[var(--color-muted-foreground)]"><MapPin aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />{centerLocation(center)}</p>
                      {center.facilityType ? <p className="mt-2 text-xs">{formatUiLabel(center.facilityType).replace(/\b[a-z]/g, (letter) => letter.toUpperCase())}</p> : null}
                    </div>
                  </div>
                  {center.duplicateReviewNotes ? <p className="mt-3 text-xs text-[var(--color-warning)]">Duplicate review: {center.duplicateReviewNotes}</p> : null}
                  <div className="mt-auto flex items-center gap-3 border-t border-[var(--color-border)] pt-4">
                    <div className="min-w-0 flex-1 text-xs text-[var(--color-muted-foreground)]">
                      <p>Identity: {formatUiLabel(center.verificationStatus)}</p>
                      {openingStatus !== "unknown" ? <p className="mt-1">{centerOpeningLabel({ openingStatus })}</p> : null}
                    </div>
                    <Link href={`/admin/data/${center.id}`} className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Manage Center <ArrowUpRight aria-hidden="true" className="h-4 w-4" /></Link>
                  </div>
                </article>;
              })}
            </div>
          )}
          {total > pageSize ? <nav aria-label="Evacuation center pagination" className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] pt-5">
            <p className="text-sm text-[var(--color-muted-foreground)]">Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}</p>
            <div className="flex w-full items-center justify-between gap-2 sm:w-auto">
              <button type="button" disabled={page <= 1} onClick={() => { setLoading(true); setError(null); setPage((current) => current - 1); }} className="inline-flex h-10 items-center gap-1 rounded-lg border border-[var(--color-border)] px-3 text-sm font-medium transition hover:bg-[var(--color-surface)] disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft aria-hidden="true" className="h-4 w-4" />Previous</button>
              <span aria-current="page" aria-label={`Page ${page} of ${Math.ceil(total / pageSize)}`} className="flex h-10 min-w-14 items-center justify-center rounded-lg bg-[var(--color-surface)] px-2 text-sm font-semibold">{page} / {Math.ceil(total / pageSize)}</span>
              <button type="button" disabled={page * pageSize >= total} onClick={() => { setLoading(true); setError(null); setPage((current) => current + 1); }} className="inline-flex h-10 items-center gap-1 rounded-lg border border-[var(--color-border)] px-3 text-sm font-medium transition hover:bg-[var(--color-surface)] disabled:cursor-not-allowed disabled:opacity-40">Next<ChevronRight aria-hidden="true" className="h-4 w-4" /></button>
            </div>
          </nav> : null}
        </>
      )}
    </div>
  );
}
