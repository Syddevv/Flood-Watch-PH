"use client";

import Link from "next/link";
import { currentCenterOpeningStatus, centerOpeningLabel } from "@/lib/emergency-resources";
import { useEffect, useState } from "react";

import { BULACAN_LOCALITIES } from "@/data/bulacan-localities";

export type AdminCenter = {
  id: string; name: string; description: string | null; address: string;
  barangay: string | null; city: string; province: string;
  latitude: number | null; longitude: number | null; contactNumber: string | null;
  facilities: string[]; status: string; verificationStatus: string;
  sourceType: string; sourceName: string | null; sourceUrl: string | null;
  notes: string | null; estimatedCapacity: number | null;
  lastVerifiedAt: string | null; availabilityConfirmedAt: string | null;
  isArchived: boolean; updatedAt: string;
  externalKey: string | null; sourceSnapshot: unknown; sourceCheckedAt: string | null;
  facilityType: string | null; permanent: boolean | null; capacityFamilies: number | null;
  currentOccupancy: number | null; currentCapacity: number | null;
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
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load centers.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [search, city, verificationStatus, archived, page]);

  const filterClass = "h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm";
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[.18em] text-[var(--color-primary)]">BULACAN EMERGENCY OPERATIONS</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">Evacuation centers</h2>
          <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">Manage source verification and current availability separately.</p>
        </div>
        <div className="flex gap-3"><Link href="/admin/emergency-contacts" className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-semibold">Manage contacts</Link><Link href="/admin/data/new" className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white">Add center</Link></div>
      </header>
      <div className="flex flex-wrap gap-2">
        <input aria-label="Search centers" value={search} onChange={(event) => { setLoading(true); setError(null); setSearch(event.target.value); setPage(1); }} placeholder="Search name or address" className={filterClass} />
        <select aria-label="Municipality or city" value={city} onChange={(event) => { setLoading(true); setError(null); setCity(event.target.value); setPage(1); }} className={filterClass}>
          <option value="">All municipalities and cities</option>
          {BULACAN_LOCALITIES.map((locality) => <option key={locality.code} value={locality.name}>{locality.name}</option>)}
        </select>
        <select aria-label="Verification" value={verificationStatus} onChange={(event) => { setLoading(true); setError(null); setVerificationStatus(event.target.value); setPage(1); }} className={filterClass}>
          <option value="">All verification states</option>
          <option value="verified">Verified</option>
          <option value="official_publication_found">Official publication found</option>
          <option value="needs_verification">Needs verification</option>
          <option value="outdated">Outdated</option>
          <option value="disputed">Disputed</option>
        </select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={archived} onChange={(event) => { setLoading(true); setError(null); setArchived(event.target.checked); setPage(1); }} />Archived</label>
      </div>
      {loading ? <p role="status">Loading centers…</p> : error ? <p role="alert" className="text-[var(--color-danger)]">{error}</p> : (
        <>
          <p className="text-sm text-[var(--color-muted-foreground)]">{total} record{total === 1 ? "" : "s"}</p>
          {centers.length === 0 ? <p className="rounded-xl border border-dashed border-[var(--color-border)] p-8 text-center">No centers match these filters.</p> : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {centers.map((center) => <article key={center.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                <h3 className="font-semibold">{center.name}</h3>
                <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{center.address}, {center.city}</p>
                <p className="mt-3 text-sm">Identity: {center.verificationStatus.replaceAll("_", " ")}</p>
                {center.externalKey ? <p className="text-xs">Imported: {center.externalKey}</p> : null}
                {center.duplicateReviewNotes ? <p className="text-xs text-[var(--color-warning)]">Duplicate review: {center.duplicateReviewNotes}</p> : null}
                <p className="text-sm">Opening status: {centerOpeningLabel({ openingStatus: currentCenterOpeningStatus(center.status, center.availabilityConfirmedAt) })}</p>
                <p className="text-sm">Estimated capacity: {center.estimatedCapacity ?? "not recorded"}</p>
                <Link href={`/admin/data/${center.id}`} className="mt-4 inline-block font-semibold text-[var(--color-primary)]">Manage center</Link>
              </article>)}
            </div>
          )}
          <div className="flex items-center gap-3">
            <button type="button" disabled={page <= 1} onClick={() => { setLoading(true); setError(null); setPage(page - 1); }}>Previous</button>
            <span>Page {page}</span>
            <button type="button" disabled={page * 24 >= total} onClick={() => { setLoading(true); setError(null); setPage(page + 1); }}>Next</button>
          </div>
        </>
      )}
    </div>
  );
}
