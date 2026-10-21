"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Building2, ChevronDown, Info, MapPin, Navigation, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { BULACAN_LOCALITIES } from "@/data/bulacan-localities";
import { isWithinBulacan } from "@/lib/bulacan-scope";
import { buildCenterMapHref, buildDirectionsUrl, calculateDistanceKm, centerListingLabel, centerOpeningLabel, formatLastVerified, formatOperationalUpdate, hasCenterCoordinates } from "@/lib/emergency-resources";
import type { PublicEmergencyContact, PublicEvacuationCenter } from "@/lib/types";

type Point = { latitude: number; longitude: number };

function openingStatusDisplay(center: PublicEvacuationCenter) {
  if (center.openingStatus === "open") return { label: "Open", className: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100" };
  if (center.openingStatus === "full") return { label: "Full", className: "bg-orange-100 text-orange-950 dark:bg-orange-900/40 dark:text-orange-100" };
  return { label: centerOpeningLabel(center), className: "bg-[var(--color-panel)] text-[var(--color-foreground)]" };
}

function drrmoForCenter(contacts: PublicEmergencyContact[], center: PublicEvacuationCenter) {
  const offices = contacts.filter((contact) => /\b(?:PDRRMO|MDRRMO|CDRRMO|DRRMO)\b/i.test(contact.agencyName));
  return offices.find((contact) => contact.city === center.city) ?? offices.find((contact) => contact.city === null) ?? null;
}

export function EvacuationCentersContent({ contacts }: { contacts: PublicEmergencyContact[] }) {
  const searchParams = useSearchParams();
  const selectedCenterId = searchParams.get("center");
  const [centers, setCenters] = useState<PublicEvacuationCenter[]>([]);
  const [municipality, setMunicipality] = useState("");
  const [query, setQuery] = useState("");
  const [facilityType, setFacilityType] = useState("");
  const [origin, setOrigin] = useState<Point | null>(null);
  const [sortMode, setSortMode] = useState<"default" | "name" | "nearest">("default");
  const [locating, setLocating] = useState(false);
  const [highlightResults, setHighlightResults] = useState(false);
  const [scrollRequest, setScrollRequest] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(selectedCenterId);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const resultsRef = useRef<HTMLElement>(null);
  const highlightTimerRef = useRef<number | null>(null);

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
      (!needle || [center.name, center.address, center.city, center.barangay ?? ""].join(" ").toLowerCase().includes(needle)),
    );
    if (sortMode === "nearest" && origin) {
      return results.sort((a, b) => (hasCenterCoordinates(a) ? calculateDistanceKm(origin, a) : Infinity) - (hasCenterCoordinates(b) ? calculateDistanceKm(origin, b) : Infinity) || a.name.localeCompare(b.name));
    }
    return results.sort((a, b) => sortMode === "name" ? a.name.localeCompare(b.name) : a.city.localeCompare(b.city) || a.name.localeCompare(b.name));
  }, [centers, municipality, facilityType, query, origin, sortMode]);
  const mappedCenters = sortMode === "nearest" ? visibleCenters.filter(hasCenterCoordinates) : visibleCenters;
  const unmappedCenters = sortMode === "nearest" ? visibleCenters.filter((center) => !hasCenterCoordinates(center)) : [];
  const representedLocalities = new Set(centers.map((center) => center.city)).size;
  const mappedTotal = centers.filter(hasCenterCoordinates).length;
  const facilityTypes = useMemo(() => [...new Set(centers.map((center) => center.facilityType).filter((type): type is string => Boolean(type)))].sort(), [centers]);
  const selectedCenter = centers.find((center) => center.id === selectedId) ?? null;
  const relevantDrrmo = selectedCenter ? drrmoForCenter(contacts, selectedCenter) : null;
  const hasFilters = Boolean(municipality || query || facilityType || sortMode !== "default");

  useEffect(() => {
    if (!scrollRequest || loading) return;
    const frame = window.requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
      setHighlightResults(true);
      if (highlightTimerRef.current !== null) window.clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = window.setTimeout(() => setHighlightResults(false), 1800);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [scrollRequest, loading]);

  useEffect(() => () => { if (highlightTimerRef.current !== null) window.clearTimeout(highlightTimerRef.current); }, []);

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
    setOrigin(null);
    setSortMode("default");
    setLocationMessage(null);
  }

  function findNearest() {
    if (locating) return;
    if (origin) {
      setSortMode("nearest");
      setLocationMessage("Sorted by distance from your location. Distances are direct lines, not travel routes.");
      setScrollRequest((value) => value + 1);
      return;
    }
    if (!navigator.geolocation) { setLocationMessage("Your browser cannot provide a location. Try again on a device with location access."); return; }
    setLocating(true);
    setLocationMessage("Finding your location…");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        if (!isWithinBulacan(coords.latitude, coords.longitude)) {
          setLocationMessage("Your location is outside Bulacan. Choose a municipality to browse all published centers.");
          return;
        }
        setOrigin({ latitude: coords.latitude, longitude: coords.longitude });
        setSortMode("nearest");
        setLocationMessage("Sorted by distance from your location. Distances are direct lines, not travel routes.");
        setScrollRequest((value) => value + 1);
      },
      (error) => {
        setLocating(false);
        setLocationMessage(error.code === error.PERMISSION_DENIED ? "Location access was denied. Allow it in your browser to sort by distance." : error.code === error.TIMEOUT ? "Location request timed out. Try again." : "Location was unavailable. Try again or choose a municipality.");
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  function renderCenterCard(center: PublicEvacuationCenter) {
    const status = openingStatusDisplay(center);
    const listing = centerListingLabel(center);
    const mapped = hasCenterCoordinates(center);
    return <article key={center.id} id={`evacuation-center-${center.id}`} className="flex h-full min-w-0 flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-[var(--color-primary)] hover:shadow-lg motion-reduce:transform-none sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]"><Building2 aria-hidden="true" className="size-5" /></span>
        {listing ? <span className="rounded-full bg-[var(--color-panel)] px-2.5 py-1 text-xs font-semibold text-[var(--color-muted-foreground)]">{listing}</span> : null}
      </div>
      <h3 className="mt-4 text-lg font-semibold leading-snug wrap-break-word text-[var(--color-foreground)]">{center.name}</h3>
      <p className="mt-3 flex items-start gap-2 text-sm leading-6 text-[var(--color-muted-foreground)]"><MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[var(--color-primary)]" />{[center.barangay, center.city].filter(Boolean).join(", ")}</p>
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-[var(--color-muted-foreground)]">
        {center.openingStatus !== "unknown" ? <span className={`rounded-full px-2.5 py-1 font-semibold ${status.className}`}>{status.label}</span> : null}
        <span className="inline-flex items-center gap-1.5"><Info aria-hidden="true" className="size-3.5" />{center.openingStatus === "unknown" ? "Check opening before going." : center.availabilityConfirmedAt ? `Updated ${formatOperationalUpdate(center.availabilityConfirmedAt)}` : "Confirm availability before traveling."}</span>
      </div>
      {sortMode === "nearest" && origin && mapped ? <p className="mt-3 text-sm font-semibold text-[var(--color-primary)]">{calculateDistanceKm(origin, center).toFixed(1)} km direct distance</p> : null}
      {!mapped ? <p className="mt-3 text-xs font-medium text-[var(--color-muted-foreground)]">Location not yet mapped</p> : null}
      <div className="mt-auto grid grid-cols-2 gap-2 border-t border-[var(--color-border)] pt-5 [margin-top:1.25rem]">
        <button type="button" aria-label={`View details for ${center.name}`} onClick={(event) => { triggerRef.current = event.currentTarget; setSelectedId(center.id); }} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--color-primary)] px-3 text-sm font-semibold text-white transition-colors hover:brightness-110 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]">View details</button>
        {mapped ? <Link href={buildCenterMapHref(center.id)} aria-label={`View ${center.name} on map`} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[var(--color-border)] px-2 text-center text-sm font-semibold transition-colors hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"><MapPin aria-hidden="true" className="size-4 shrink-0" />View on map</Link> : <button type="button" disabled title="Location not yet mapped" aria-label={`View ${center.name} on map unavailable: location not yet mapped`} className="inline-flex min-h-11 cursor-not-allowed items-center justify-center gap-1.5 rounded-xl border border-[var(--color-disabled-border)] px-2 text-center text-sm font-semibold text-[var(--color-disabled-text)]"><MapPin aria-hidden="true" className="size-4 shrink-0" />View on map</button>}
      </div>
      {mapped ? <a href={buildDirectionsUrl(center, origin)} aria-label={`Directions to ${center.name}`} target="_blank" rel="noopener noreferrer" className="mt-3 self-start text-xs font-medium text-[var(--color-muted-foreground)] underline-offset-2 hover:text-[var(--color-primary)] hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"><Navigation aria-hidden="true" className="mr-1 inline size-3.5" />Directions</a> : null}
    </article>;
  }

  return <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 pb-24 md:px-8 md:py-8">
    <header className="space-y-2">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]"><MapPin aria-hidden="true" className="size-4" />Bulacan directory</p>
      <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Evacuation Centers</h1>
      <p className="text-base leading-relaxed text-[var(--color-muted-foreground)]">Find designated evacuation centers across Bulacan and explore their locations.</p>
      <p className="flex items-start gap-2 text-sm leading-relaxed text-[var(--color-muted-foreground)]"><Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />Availability may change during emergencies. Confirm a center&apos;s status before traveling.</p>
    </header>

    {!loading && !error ? <div className="flex flex-wrap gap-x-8 gap-y-3 border-y border-[var(--color-border)] py-4 text-sm text-[var(--color-muted-foreground)]" aria-label="Directory summary">
      <p><strong className="mr-1.5 text-lg text-[var(--color-foreground)]">{centers.length}</strong>listed centers</p>
      <p><strong className="mr-1.5 text-lg text-[var(--color-foreground)]">{representedLocalities}</strong>municipalities and cities</p>
      <p><strong className="mr-1.5 text-lg text-[var(--color-foreground)]">{mappedTotal}</strong>mapped locations</p>
    </div> : null}

    <div className="space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm sm:p-5">
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1.35fr_0.85fr]">
      <label className="grid min-w-0 gap-1.5 text-sm font-semibold">Municipality or city
        <select value={municipality} onChange={(event) => setMunicipality(event.target.value)} className="min-h-11 w-full min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm font-normal focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]">
          <option value="">All municipalities</option>
          {BULACAN_LOCALITIES.map((locality) => <option key={locality.code} value={locality.name}>{locality.name}</option>)}
        </select>
      </label>
      <label className="grid min-w-0 gap-1.5 text-sm font-semibold">Search by center or barangay
        <span className="relative"><Search aria-hidden="true" className="absolute left-3 top-3 size-4 text-[var(--color-muted-foreground)]" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} className="min-h-11 w-full min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] pl-9 pr-3 text-sm font-normal focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]" /></span>
      </label>
      <label className="grid min-w-0 gap-1.5 text-sm font-semibold">Sort by
        <select value={sortMode} onChange={(event) => { if (event.target.value === "nearest") findNearest(); else { setSortMode(event.target.value as "default" | "name"); setLocationMessage(null); } }} className="min-h-11 w-full min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 text-sm font-normal focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]">
          <option value="default">Default</option><option value="name">Name A–Z</option><option value="nearest">Nearest to me</option>
        </select>
      </label>
    </div>

    <details className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-background)]">
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm font-semibold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"><SlidersHorizontal aria-hidden="true" className="size-4" />More filters<ChevronDown aria-hidden="true" className="ml-auto size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" /></summary>
      <div className="grid gap-4 border-t border-[var(--color-border)] p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className="grid gap-1.5 text-sm font-medium">Facility type
          <select value={facilityType} onChange={(event) => setFacilityType(event.target.value)} className="min-h-11 min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"><option value="">All types</option>{facilityTypes.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}</select>
        </label>
        <button type="button" onClick={() => { setLoading(true); setError(null); setRefreshKey((value) => value + 1); }} className="min-h-11 rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold hover:border-[var(--color-primary)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]">Refresh list</button>
      </div>
    </details>
    </div>

    {locationMessage ? <p role="status" className="text-sm text-[var(--color-muted-foreground)]">{locationMessage}{!locating && sortMode !== "nearest" && origin === null ? <button type="button" onClick={findNearest} className="ml-2 font-semibold text-[var(--color-primary)] underline underline-offset-2">Retry</button> : null}</p> : null}
    {locating ? <p role="status" className="text-sm text-[var(--color-muted-foreground)]">Sorting by location…</p> : null}
    {loading ? <p role="status" className="text-sm">Loading centers…</p> : error ? <div role="alert" className="space-y-3 text-sm"><p>Unable to load centers. Please try again.</p><button type="button" onClick={() => { setLoading(true); setError(null); setRefreshKey((value) => value + 1); }} className="min-h-11 rounded-xl border border-[var(--color-border)] px-4 font-semibold">Retry</button></div> : <section ref={resultsRef} aria-label="Evacuation center results" className={`scroll-mt-5 rounded-2xl border p-4 transition-[border-color,background-color,box-shadow] duration-700 sm:p-5 ${highlightResults ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] shadow-md" : "border-transparent"}`}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div><h2 aria-live="polite" className="text-xl font-bold">{visibleCenters.length} center{visibleCenters.length === 1 ? "" : "s"} found</h2>{sortMode === "nearest" ? <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">Sorted by nearest distance · mapped locations first</p> : sortMode === "name" ? <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">Sorted by name A–Z</p> : null}</div>
        {hasFilters ? <button type="button" onClick={clearFilters} className="min-h-11 rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold transition-colors hover:border-[var(--color-primary)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]">Clear search and filters</button> : null}
      </div>
      {visibleCenters.length === 0 ? <div className="rounded-xl border border-dashed border-[var(--color-border)] p-6 text-sm leading-relaxed"><p>No centers match this search. Try another municipality or clear the filters.</p>{hasFilters ? <button type="button" onClick={clearFilters} className="mt-3 min-h-11 font-semibold text-[var(--color-primary)] underline underline-offset-2">Clear filters</button> : null}</div> : <div className="space-y-8">
        {sortMode === "nearest" ? <div><h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">Mapped centers · {mappedCenters.length}</h3>{mappedCenters.length ? <div className="grid items-stretch gap-4 lg:grid-cols-2">{mappedCenters.map(renderCenterCard)}</div> : <p className="text-sm text-[var(--color-muted-foreground)]">No mapped centers match these filters.</p>}</div> : <div className="grid items-stretch gap-4 lg:grid-cols-2">{mappedCenters.map(renderCenterCard)}</div>}
        {sortMode === "nearest" && unmappedCenters.length ? <div><h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">Location not yet mapped · {unmappedCenters.length}</h3><p className="mb-4 text-sm text-[var(--color-muted-foreground)]">Distances are available only for mapped centers. These locations remain in the directory.</p><div className="grid items-stretch gap-4 lg:grid-cols-2">{unmappedCenters.map(renderCenterCard)}</div></div> : null}
      </div>}
      <p className="mt-6 text-xs leading-relaxed text-[var(--color-muted-foreground)]">This partial directory is still being expanded. Confirm availability and route safety before traveling.</p>
    </section>}

    {selectedCenter ? <dialog ref={dialogRef} aria-labelledby="center-detail-title" onClose={() => { setSelectedId(null); triggerRef.current?.focus(); }} className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto overscroll-contain rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-0 text-[var(--color-foreground)] shadow-2xl backdrop:bg-slate-950/70">
      <div className="p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <h2 id="center-detail-title" className="text-2xl font-bold leading-snug wrap-break-word">{selectedCenter.name}</h2>
          <button ref={closeButtonRef} type="button" onClick={() => dialogRef.current?.close()} aria-label="Close details" className="flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"><X aria-hidden="true" className="h-6 w-6" /></button>
        </div>
        <p className="mt-3 text-lg">{[selectedCenter.barangay, selectedCenter.city].filter(Boolean).join(", ")}</p>
        <p className="mt-4 text-lg"><span className="font-semibold">Listing:</span> {centerListingLabel(selectedCenter) ?? "Listing not confirmed"}</p>
        <p className="mt-3 text-lg"><span className="font-semibold">Opening status:</span> <span className={`inline-block rounded-lg px-3 py-2 font-bold ${openingStatusDisplay(selectedCenter).className}`}>{centerOpeningLabel(selectedCenter)}</span></p>
        {selectedCenter.openingStatus === "unknown" ? <p className="mt-2 text-lg">Check with the local DRRMO before going.</p> : selectedCenter.availabilityConfirmedAt ? <p className="mt-2 text-base">Operational update: {formatOperationalUpdate(selectedCenter.availabilityConfirmedAt)}</p> : null}
        {selectedCenter.address ? <p className="mt-5 text-lg leading-relaxed"><span className="font-semibold">Address:</span> {selectedCenter.address}</p> : null}
        {hasCenterCoordinates(selectedCenter) ? <div className="mt-5 flex flex-wrap gap-3">
          <Link href={buildCenterMapHref(selectedCenter.id)} className="inline-flex min-h-12 items-center rounded-xl border border-[var(--color-border)] px-4 text-lg font-semibold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]">View on map</Link>
          <a href={buildDirectionsUrl(selectedCenter, origin)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center rounded-xl bg-[var(--color-primary)] px-4 text-lg font-semibold text-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"><Navigation aria-hidden="true" className="mr-2 h-5 w-5" />Directions</a>
          <p className="w-full text-base">Map location is a reference. Route safety is not confirmed.</p>
        </div> : <p className="mt-5 text-lg">Exact location unavailable. Contact the local DRRMO for guidance.</p>}
        {relevantDrrmo ? <div className="mt-5 rounded-xl border border-[var(--color-border)] p-4 text-lg">
          <p className="font-semibold">{relevantDrrmo.city ? "Municipal or city DRRMO contact" : "Bulacan PDRRMO contact"}</p>
          <p>{relevantDrrmo.agencyName}</p>
          {relevantDrrmo.phones[0] ? <p className="mt-2">{relevantDrrmo.phones[0].telUri ? <a href={relevantDrrmo.phones[0].telUri} className="font-semibold text-[var(--color-primary)] underline">Call {relevantDrrmo.phones[0].raw}</a> : relevantDrrmo.phones[0].raw}</p> : null}
          <p className="mt-2 text-base">This is the DRRMO contact, not the facility’s direct number. Confirm that the number is current.</p>
        </div> : null}
        <Link href="/emergency-hotlines" className="mt-4 inline-flex min-h-12 items-center rounded-xl border border-[var(--color-border)] px-4 text-lg font-semibold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]">Find local emergency contacts</Link>
        {selectedCenter.contactNumber ? <p className="mt-4 text-lg"><span className="font-semibold">Listed facility contact:</span> {selectedCenter.contactNumber}</p> : null}
        {selectedCenter.facilityType ? <p className="mt-5 text-lg"><span className="font-semibold">Facility type:</span> {selectedCenter.facilityType.replaceAll("_", " ")}{selectedCenter.permanent === true ? " · Permanent facility" : selectedCenter.permanent === false ? " · Temporary-use site" : ""}</p> : null}
        {selectedCenter.estimatedCapacity != null || selectedCenter.capacityFamilies != null ? <p className="mt-4 text-lg leading-relaxed"><span className="font-semibold">Historical or planned capacity:</span> {[selectedCenter.estimatedCapacity != null ? `${selectedCenter.estimatedCapacity} people` : null, selectedCenter.capacityFamilies != null ? `${selectedCenter.capacityFamilies} families` : null].filter(Boolean).join(" · ")}. This is not a count of available spaces.</p> : null}
        {selectedCenter.facilities.length ? <p className="mt-4 text-lg"><span className="font-semibold">Listed facilities:</span> {selectedCenter.facilities.join(", ").replaceAll("_", " ")}</p> : null}

        <details className="mt-6 border-t border-[var(--color-border)] pt-3">
          <summary className="flex min-h-12 cursor-pointer items-center text-lg font-semibold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]">Sources and updates</summary>
          <div className="space-y-3 pb-3 text-base leading-relaxed">
            {selectedCenter.sourceCheckedAt ? <p>Source researched {formatLastVerified(selectedCenter.sourceCheckedAt)}.</p> : null}
            {selectedCenter.lastDocumentedEventDate ? <p>Documented event: {formatLastVerified(selectedCenter.lastDocumentedEventDate)}.</p> : null}
            {selectedCenter.verificationStatus === "outdated" ? <p>Source needs rechecking.</p> : null}
            {selectedCenter.locationProvenance ? <p>{selectedCenter.locationProvenance}</p> : null}
            {selectedCenter.locationNotes ? <p>{selectedCenter.locationNotes}</p> : null}
            {selectedCenter.sourceNotes ? <p>{selectedCenter.sourceNotes}</p> : null}
            {selectedCenter.sourceLinks.length ? <ul className="space-y-2">{selectedCenter.sourceLinks.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] underline underline-offset-2 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]">{source.title}{source.publishedAt ? ` (${source.publishedAt})` : ""}</a></li>)}</ul> : selectedCenter.sourceUrl ? <a href={selectedCenter.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] underline underline-offset-2">Official source</a> : null}
          </div>
        </details>
      </div>
    </dialog> : null}
  </div>;
}
