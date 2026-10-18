"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BULACAN_LOCALITIES } from "@/data/bulacan-localities";
import { isWithinBulacan } from "@/lib/bulacan-scope";
import { buildCenterMapHref, buildDirectionsUrl, calculateDistanceKm, CENTER_OPENING_UNKNOWN, formatLastVerified, hasCenterCoordinates } from "@/lib/emergency-resources";
import type { PublicEvacuationCenter } from "@/lib/types";

type Point = { latitude: number; longitude: number };

function availabilityLabel(center: PublicEvacuationCenter) {
  if (center.availability === "confirmed_available") return "Availability recently confirmed";
  if (center.availability === "confirmed_unavailable") return "Temporarily unavailable";
  return CENTER_OPENING_UNKNOWN;
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

  return <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 md:px-8">
    <header>
      <h1 className="text-3xl font-semibold">Bulacan evacuation centers</h1>
      <p className="mt-2 max-w-3xl text-sm text-[var(--color-muted-foreground)]">This partial directory contains sourced facilities across parts of Bulacan and is still being expanded. Listings do not establish that a shelter is open, safe, or has space. Confirm with the local DRRMO before travel.</p>
    </header>
    <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
      <label className="grid gap-1 text-sm">Municipality or city
        <select value={municipality} onChange={(event) => setMunicipality(event.target.value)} className="h-11 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3">
          <option value="">All of Bulacan</option>
          {BULACAN_LOCALITIES.map((locality) => <option key={locality.code} value={locality.name}>{locality.name}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-sm">Search centers
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or address" className="h-11 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3" />
      </label>
      <button type="button" onClick={findNearest} className="self-end rounded-lg border border-[var(--color-border)] px-4 py-3 text-sm font-semibold">Sort nearest to me</button>
    </div>
    <div className="flex flex-wrap gap-3 text-sm">
      <label className="grid gap-1">Facility type<select value={facilityType} onChange={(event) => setFacilityType(event.target.value)} className="h-11 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3"><option value="">All types</option>{facilityTypes.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}</select></label>
      <label className="grid gap-1">Opening status<select value={openingStatus} onChange={(event) => setOpeningStatus(event.target.value)} className="h-11 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3"><option value="">All statuses</option><option value="unknown">Unknown</option><option value="confirmed_available">Recently confirmed available</option><option value="confirmed_unavailable">Recently confirmed unavailable</option></select></label>
    </div>
    {locationMessage ? <p role="status" className="text-sm">{locationMessage}</p> : null}
    {loading ? <p role="status">Loading published centers…</p> : error ? <div role="alert"><p>{error}</p><button type="button" onClick={() => { setLoading(true); setError(null); setRefreshKey((value) => value + 1); }}>Retry</button></div> : (
      <>
        <div className="flex items-center justify-between gap-3"><p className="text-sm text-[var(--color-muted-foreground)]">{visibleCenters.length} published center{visibleCenters.length === 1 ? "" : "s"}</p><button type="button" onClick={() => { setLoading(true); setError(null); setRefreshKey((value) => value + 1); }} className="text-sm text-[var(--color-primary)]">Refresh</button></div>
        {visibleCenters.length === 0 ? <p className="rounded-xl border border-dashed border-[var(--color-border)] p-8 text-sm">No facility from this partial directory matches{municipality ? ` ${municipality}` : " this selection"}. This does not mean there are no evacuation centers there; contact the local DRRMO for current guidance.</p> : (
          <div className="grid gap-4 md:grid-cols-2">
            {visibleCenters.map((center) => <article key={center.id} id={`evacuation-center-${center.id}`} className={`rounded-xl border bg-[var(--color-surface)] p-5 ${selectedCenterId === center.id ? "border-[var(--color-primary)]" : "border-[var(--color-border)]"}`}>
              <h2 className="text-lg font-semibold">{center.name}</h2>
              <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{center.address}, {center.city}</p>
              <p className="mt-1 text-sm">{center.facilityType?.replaceAll("_", " ") ?? "Facility type not recorded"} · {center.permanent === true ? "Permanent facility" : center.permanent === false ? "Temporary-use site" : "Permanent status unconfirmed"}</p>
              {origin && hasCenterCoordinates(center) ? <p className="mt-2 text-sm">~{calculateDistanceKm(origin, center).toFixed(1)} km direct distance; route safety unknown</p> : null}
              <p className="mt-3 text-sm font-semibold">{availabilityLabel(center)}</p>
              <p className="mt-1 text-sm">Official publication found{center.verificationStatus === "outdated" ? "; source needs rechecking" : ""} · Source researched {center.sourceCheckedAt ? formatLastVerified(center.sourceCheckedAt) : "date unknown"}</p>
              {center.lastDocumentedEventDate ? <p className="mt-1 text-sm">Historical event: {formatLastVerified(center.lastDocumentedEventDate)}</p> : null}
              {center.estimatedCapacity != null ? <p className="mt-1 text-sm">Historical/planned capacity: {center.estimatedCapacity} people. Current occupancy and available spaces unknown.</p> : null}
              <p className="mt-1 text-sm">{center.facilities.length ? `Reported facilities: ${center.facilities.join(", ").replaceAll("_", " ")}` : "Facilities not recorded"}</p>
              {center.sourceNotes ? <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">{center.sourceNotes}</p> : null}
              <p className="mt-2 text-sm">{center.locationProvenance ?? (hasCenterCoordinates(center) ? "Location reference; confirm locally" : "Exact location unavailable; no map pin or directions")}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">{center.sourceLinks.length ? center.sourceLinks.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] underline">{source.title}{source.publishedAt ? ` (${source.publishedAt})` : ""}</a>) : center.sourceUrl ? <a href={center.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] underline">Official source</a> : null}</div>
              {hasCenterCoordinates(center) ? <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold"><Link href={buildCenterMapHref(center.id)} className="text-[var(--color-primary)]">View on map</Link><a href={buildDirectionsUrl(center, origin)} target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)]">Directions (route safety unconfirmed)</a></div> : null}
            </article>)}
          </div>
        )}
      </>
    )}
  </main>;
}
