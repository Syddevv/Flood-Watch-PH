"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronDown, MapPin, Navigation, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { BULACAN_LOCALITIES } from "@/data/bulacan-localities";
import { isWithinBulacan } from "@/lib/bulacan-scope";
import { buildCenterMapHref, buildDirectionsUrl, calculateDistanceKm, formatLastVerified, hasCenterCoordinates } from "@/lib/emergency-resources";
import type { PublicEvacuationCenter } from "@/lib/types";

type Point = { latitude: number; longitude: number };

function openingStatusDisplay(center: PublicEvacuationCenter) {
  if (center.availability === "confirmed_available") return { label: "Open", className: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100" };
  if (center.availability === "confirmed_unavailable") return { label: "Temporarily unavailable", className: "bg-amber-100 text-amber-950 dark:bg-amber-900/40 dark:text-amber-100" };
  return { label: "Opening not confirmed", className: "bg-[var(--color-panel)] text-[var(--color-foreground)]" };
}

export function EvacuationCentersContent() {
  const searchParams = useSearchParams();
  const selectedCenterId = searchParams.get("center");
  const [centers, setCenters] = useState<PublicEvacuationCenter[]>([]);
  const [municipality, setMunicipality] = useState("");
  const [query, setQuery] = useState("");
  const [facilityType, setFacilityType] = useState("");
  const [openingStatus, setOpeningStatus] = useState("");
  const [origin, setOrigin] = useState<Point | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(selectedCenterId);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/evacuation-centers", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Unable to load centers.");
        setCenters(payload.data.centers);
      })
      .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load centers."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refreshKey]);

  const visibleCenters = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const results = centers.filter((center) =>
      (!municipality || center.city === municipality) &&
      (!facilityType || center.facilityType === facilityType) &&
      (!openingStatus || center.availability === openingStatus) &&
      (!needle || [center.name, center.address, center.city, center.barangay ?? ""].join(" ").toLowerCase().includes(needle)),
    );
    return origin
      ? results.sort((a, b) => (hasCenterCoordinates(a) ? calculateDistanceKm(origin, a) : Infinity) - (hasCenterCoordinates(b) ? calculateDistanceKm(origin, b) : Infinity))
      : results.sort((a, b) => a.city.localeCompare(b.city) || a.name.localeCompare(b.name));
  }, [centers, municipality, facilityType, openingStatus, query, origin]);
  const facilityTypes = useMemo(() => [...new Set(centers.map((center) => center.facilityType).filter((type): type is string => Boolean(type)))].sort(), [centers]);
  const selectedCenter = centers.find((center) => center.id === selectedId) ?? null;
  const hasFilters = Boolean(municipality || query || facilityType || openingStatus || origin);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (selectedCenter && dialog && !dialog.open) {
      dialog.showModal();
      closeButtonRef.current?.focus();
    }
  }, [selectedCenter]);

  function clearFilters() {
    setMunicipality("");
    setQuery("");
    setFacilityType("");
    setOpeningStatus("");
    setOrigin(null);
    setLocationMessage(null);
  }

  function findNearest() {
    if (!navigator.geolocation) { setLocationMessage("Your browser cannot provide a location. Choose a municipality instead."); return; }
    setLocationMessage("Finding your location…");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (!isWithinBulacan(coords.latitude, coords.longitude)) {
          setLocationMessage("Your location is outside Bulacan. Choose a municipality to browse all published centers.");
          return;
        }
        setOrigin({ latitude: coords.latitude, longitude: coords.longitude });
        setLocationMessage("Centers are ordered by direct distance. Confirm road access before travel.");
      },
      () => setLocationMessage("Location was unavailable. Choose a municipality instead."),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  return <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 pb-24 md:px-8 md:py-8">
    <header>
      <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Evacuation Centers</h1>
      <p className="mt-2 text-lg leading-relaxed">Find an evacuation center near you.</p>
    </header>

    <div className="grid gap-5 md:grid-cols-2">
      <label className="grid gap-2 text-lg font-semibold">Municipality or city
        <select value={municipality} onChange={(event) => setMunicipality(event.target.value)} className="min-h-12 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-lg font-normal focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]">
          <option value="">All municipalities</option>
          {BULACAN_LOCALITIES.map((locality) => <option key={locality.code} value={locality.name}>{locality.name}</option>)}
        </select>
      </label>
      <label className="grid gap-2 text-lg font-semibold">Search by center or barangay
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} className="min-h-12 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-lg font-normal focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]" />
      </label>
    </div>

    <details className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      <summary className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-4 text-lg font-semibold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"><SlidersHorizontal aria-hidden="true" className="h-5 w-5" />More filters<ChevronDown aria-hidden="true" className="ml-auto h-5 w-5" /></summary>
      <div className="grid gap-4 border-t border-[var(--color-border)] p-4 md:grid-cols-2">
        <label className="grid gap-2 text-lg font-medium">Facility type
          <select value={facilityType} onChange={(event) => setFacilityType(event.target.value)} className="min-h-12 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-lg focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"><option value="">All types</option>{facilityTypes.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}</select>
        </label>
        <label className="grid gap-2 text-lg font-medium">Opening status
          <select value={openingStatus} onChange={(event) => setOpeningStatus(event.target.value)} className="min-h-12 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-lg focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"><option value="">All statuses</option><option value="unknown">Opening not confirmed</option><option value="confirmed_available">Open</option><option value="confirmed_unavailable">Temporarily unavailable</option></select>
        </label>
        <div className="flex flex-wrap gap-3 md:col-span-2">
          <button type="button" onClick={findNearest} className="min-h-12 rounded-xl border border-[var(--color-border)] px-4 text-lg font-semibold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"><MapPin aria-hidden="true" className="mr-2 inline h-5 w-5" />Sort nearest to me</button>
          <button type="button" onClick={() => { setLoading(true); setError(null); setRefreshKey((value) => value + 1); }} className="min-h-12 rounded-xl border border-[var(--color-border)] px-4 text-lg font-semibold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]">Refresh list</button>
        </div>
      </div>
    </details>

    {locationMessage ? <p role="status" className="text-lg">{locationMessage}</p> : null}
    {loading ? <p role="status" className="text-lg">Loading centers…</p> : error ? <div role="alert" className="space-y-3 text-lg"><p>Unable to load centers. Please try again.</p><button type="button" onClick={() => { setLoading(true); setError(null); setRefreshKey((value) => value + 1); }} className="min-h-12 rounded-xl border border-[var(--color-border)] px-5 font-semibold">Retry</button></div> : <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="text-lg font-semibold">{visibleCenters.length} center{visibleCenters.length === 1 ? "" : "s"} found</p>
        {hasFilters ? <button type="button" onClick={clearFilters} className="min-h-12 rounded-xl border border-[var(--color-border)] px-4 text-lg font-semibold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]">Clear search and filters</button> : null}
      </div>
      {visibleCenters.length === 0 ? <p className="rounded-xl border border-dashed border-[var(--color-border)] p-6 text-lg leading-relaxed">No centers match this search. Try another municipality or clear the filters. This directory is still being expanded.</p> : <div className="grid items-start gap-4 lg:grid-cols-2">
        {visibleCenters.map((center) => {
          const status = openingStatusDisplay(center);
          return <article key={center.id} id={`evacuation-center-${center.id}`} className="flex h-full flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm sm:p-6">
            <h2 className="text-xl font-bold leading-snug wrap-break-word">{center.name}</h2>
            <p className="mt-3 flex items-start gap-2 text-lg leading-relaxed"><MapPin aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-[var(--color-primary)]" />{[center.barangay, center.city].filter(Boolean).join(", ")}</p>
            <p className={`mt-4 w-fit rounded-lg px-3 py-2 text-lg font-bold ${status.className}`}>{status.label}</p>
            {origin && hasCenterCoordinates(center) ? <p className="mt-3 text-lg">{calculateDistanceKm(origin, center).toFixed(1)} km direct distance</p> : null}
            <div className="mt-auto flex flex-wrap gap-3 pt-6">
              <button type="button" aria-label={`View details for ${center.name}`} onClick={(event) => { triggerRef.current = event.currentTarget; setSelectedId(center.id); }} className="min-h-12 rounded-xl bg-[var(--color-primary)] px-5 text-lg font-bold text-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]">View details</button>
              {hasCenterCoordinates(center) ? <a href={buildDirectionsUrl(center, origin)} aria-label={`Directions to ${center.name}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center rounded-xl border border-[var(--color-border)] px-5 text-lg font-bold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"><Navigation aria-hidden="true" className="mr-2 h-5 w-5" />Directions</a> : null}
            </div>
          </article>;
        })}
      </div>}
      <p className="text-base leading-relaxed text-[var(--color-muted-foreground)]">This is a partial directory. Check opening status with your local DRRMO before going.</p>
    </>}

    {selectedCenter ? <dialog ref={dialogRef} aria-labelledby="center-detail-title" onClose={() => { setSelectedId(null); triggerRef.current?.focus(); }} className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto overscroll-contain rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-0 text-[var(--color-foreground)] shadow-2xl backdrop:bg-slate-950/70">
      <div className="p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <h2 id="center-detail-title" className="text-2xl font-bold leading-snug wrap-break-word">{selectedCenter.name}</h2>
          <button ref={closeButtonRef} type="button" onClick={() => dialogRef.current?.close()} aria-label="Close details" className="flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"><X aria-hidden="true" className="h-6 w-6" /></button>
        </div>
        <p className="mt-3 text-lg">{[selectedCenter.barangay, selectedCenter.city].filter(Boolean).join(", ")}</p>
        <p className={`mt-4 w-fit rounded-lg px-3 py-2 text-lg font-bold ${openingStatusDisplay(selectedCenter).className}`}>{openingStatusDisplay(selectedCenter).label}</p>
        {selectedCenter.availability === "unknown" ? <p className="mt-3 text-lg">Please contact the local DRRMO before going.</p> : null}
        {selectedCenter.address ? <p className="mt-5 text-lg leading-relaxed"><span className="font-semibold">Address:</span> {selectedCenter.address}</p> : null}
        {hasCenterCoordinates(selectedCenter) ? <div className="mt-5 flex flex-wrap gap-3">
          <Link href={buildCenterMapHref(selectedCenter.id)} className="inline-flex min-h-12 items-center rounded-xl border border-[var(--color-border)] px-4 text-lg font-semibold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]">View on map</Link>
          <a href={buildDirectionsUrl(selectedCenter, origin)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center rounded-xl bg-[var(--color-primary)] px-4 text-lg font-semibold text-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"><Navigation aria-hidden="true" className="mr-2 h-5 w-5" />Directions</a>
          <p className="w-full text-base">Map location is a reference. Route safety is not confirmed.</p>
        </div> : <p className="mt-5 text-lg">Exact location unavailable. Contact the local DRRMO for guidance.</p>}
        <Link href="/emergency-hotlines" className="mt-4 inline-flex min-h-12 items-center rounded-xl border border-[var(--color-border)] px-4 text-lg font-semibold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]">Find local emergency contacts</Link>
        {selectedCenter.contactNumber ? <p className="mt-4 text-lg"><span className="font-semibold">Listed facility contact:</span> {selectedCenter.contactNumber}</p> : null}
        {selectedCenter.facilityType ? <p className="mt-5 text-lg"><span className="font-semibold">Facility type:</span> {selectedCenter.facilityType.replaceAll("_", " ")}{selectedCenter.permanent === true ? " · Permanent facility" : selectedCenter.permanent === false ? " · Temporary-use site" : ""}</p> : null}
        {selectedCenter.estimatedCapacity != null || selectedCenter.capacityFamilies != null ? <p className="mt-4 text-lg leading-relaxed"><span className="font-semibold">Historical or planned capacity:</span> {[selectedCenter.estimatedCapacity != null ? `${selectedCenter.estimatedCapacity} people` : null, selectedCenter.capacityFamilies != null ? `${selectedCenter.capacityFamilies} families` : null].filter(Boolean).join(" · ")}. This is not a count of available spaces.</p> : null}
        {selectedCenter.facilities.length ? <p className="mt-4 text-lg"><span className="font-semibold">Listed facilities:</span> {selectedCenter.facilities.join(", ").replaceAll("_", " ")}</p> : null}

        <details className="mt-6 border-t border-[var(--color-border)] pt-3">
          <summary className="flex min-h-12 cursor-pointer items-center text-lg font-semibold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]">Sources and updates</summary>
          <div className="space-y-3 pb-3 text-base leading-relaxed">
            {selectedCenter.sourceCheckedAt ? <p>Source researched {formatLastVerified(selectedCenter.sourceCheckedAt)}.</p> : null}
            {selectedCenter.availabilityConfirmedAt ? <p>Opening status checked {formatLastVerified(selectedCenter.availabilityConfirmedAt)}.</p> : null}
            {selectedCenter.lastDocumentedEventDate ? <p>Documented event: {formatLastVerified(selectedCenter.lastDocumentedEventDate)}.</p> : null}
            {selectedCenter.verificationStatus === "outdated" ? <p>Source needs rechecking.</p> : null}
            {selectedCenter.locationProvenance ? <p>{selectedCenter.locationProvenance}</p> : null}
            {selectedCenter.sourceNotes ? <p>{selectedCenter.sourceNotes}</p> : null}
            {selectedCenter.sourceLinks.length ? <ul className="space-y-2">{selectedCenter.sourceLinks.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] underline underline-offset-2 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]">{source.title}{source.publishedAt ? ` (${source.publishedAt})` : ""}</a></li>)}</ul> : selectedCenter.sourceUrl ? <a href={selectedCenter.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] underline underline-offset-2">Official source</a> : null}
          </div>
        </details>
      </div>
    </dialog> : null}
  </div>;
}
