"use client";
import Link from "next/link";
import { ChevronRight, MapPin, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { NEARBY_EVACUATION_CENTERS } from "@/lib/evacuation-center-scope";

export type AdminCenter = { id: string; name: string; address: string; barangay: string | null; city: string; province: string; latitude: number; longitude: number; facilities: string[]; status: string; verificationStatus: string; estimatedCapacity: number | null; lastVerifiedAt: string | null; updatedAt: string };

function statusTone(status: string) { const value = status.toLowerCase(); if (value === "available") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"; if (value.includes("unavailable")) return "border-red-500/40 bg-red-500/10 text-red-500"; return "border-amber-500/40 bg-amber-500/10 text-amber-500"; }
function label(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }

export function AdminEvacuationCentersPage() {
  const [search, setSearch] = useState("");
  const centers = useMemo<AdminCenter[]>(() => NEARBY_EVACUATION_CENTERS.map((center) => ({
    ...center,
    barangay: center.barangay ?? null,
    estimatedCapacity: center.estimatedCapacity ?? null,
    lastVerifiedAt: center.lastVerifiedAt ?? null,
    updatedAt: center.lastVerifiedAt ?? "",
  })), []);
  const filteredCenters = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return centers;
    return centers.filter((center) => [center.name, center.address, center.barangay ?? "", center.city, center.province].join(" ").toLowerCase().includes(query));
  }, [centers, search]);
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[.18em] text-[var(--color-primary)]">CALUMPIT EMERGENCY OPERATIONS</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">Evacuation centers</h2>
          <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">Manage verified capacity, facilities, accessibility, and center operating status.</p>
        </div>
        <Link href="/admin/data/new" className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 text-sm font-semibold text-white"><Plus className="h-4 w-4" />Add center</Link>
      </header>
      <label className="flex max-w-md items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3"><Search className="h-4 w-4 text-[var(--color-muted-foreground)]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search evacuation centers" className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none" /></label>
      {filteredCenters.length ? (
        <div className="grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-4">
          {filteredCenters.map((center) => (
            <article key={center.id} className="flex min-h-[348px] flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-soft)]">
              <div className="grid min-h-[92px] grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0"><h3 className="text-[15px] font-bold leading-6">{center.name}</h3><p className="mt-2 flex min-h-8 items-start gap-1 text-xs leading-4 text-[var(--color-muted-foreground)]"><MapPin className="mt-0.5 h-3 w-3 shrink-0" />{center.barangay ? `Brgy. ${center.barangay}` : center.address}</p></div>
                <span className={`shrink-0 rounded-lg border px-2.5 py-2 text-[11px] font-semibold ${statusTone(center.status)}`}>{label(center.status)}</span>
              </div>
              <div className="mt-4 border-t border-[var(--color-border)] pt-4"><div className="flex items-center justify-between gap-3 text-sm"><span>Estimated capacity</span><strong className="text-right">{center.estimatedCapacity?.toLocaleString() ?? "Not recorded"}</strong></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--color-panel)]"><div className="h-full rounded-full bg-[var(--color-primary)]" style={{ width: center.estimatedCapacity ? "35%" : "0%" }} /></div></div>
              <p className="mt-5 text-sm font-bold">{center.city}, {center.province}</p>
              <div className="mt-4 min-h-6">{center.facilities.length ? <div className="flex flex-wrap gap-1.5">{center.facilities.slice(0, 4).map((facility) => <span key={facility} className="rounded-md bg-[var(--color-panel)] px-2 py-1 text-[11px] font-medium">{label(facility)}</span>)}</div> : <span className="text-xs text-[var(--color-muted-foreground)]">No facilities recorded</span>}</div>
              <div className="mt-auto pt-3"><p className="text-xs text-[var(--color-muted-foreground)]">Verification: {label(center.verificationStatus)}</p><Link href={`/admin/data/${center.id}`} className="mt-3 flex h-10 items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] text-sm font-semibold hover:bg-[var(--color-panel)]">Manage center <ChevronRight className="h-4 w-4" /></Link></div>
            </article>
          ))}
        </div>
      ) : <p className="rounded-xl border border-dashed border-[var(--color-border)] p-8 text-center text-sm text-[var(--color-muted-foreground)]">No evacuation centers match this search.</p>}
    </div>
  );
}
