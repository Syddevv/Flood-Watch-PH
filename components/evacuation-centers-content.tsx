"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BULACAN_LOCALITIES } from "@/data/bulacan-localities";
import { isWithinBulacan } from "@/lib/bulacan-scope";
import { buildCenterMapHref, buildDirectionsUrl, calculateDistanceKm, formatLastVerified } from "@/lib/emergency-resources";
import type { PublicEvacuationCenter } from "@/lib/types";

type Point = { latitude: number; longitude: number };

function availabilityLabel(center: PublicEvacuationCenter) {
  if (center.verificationStatus === "outdated") return "Reference needs rechecking · Availability unknown";
  if (center.availability === "confirmed_available") return "Availability recently confirmed";
  if (center.availability === "confirmed_unavailable") return "Temporarily unavailable";
  return "Availability unknown";
}

export function EvacuationCentersContent() {
  const searchParams = useSearchParams();
  const selectedCenterId = searchParams.get("center");
  const [centers, setCenters] = useState<PublicEvacuationCenter[]>([]);
  const [municipality, setMunicipality] = useState("");
  const [query, setQuery] = useState("");
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
      (!needle || [center.name, center.address, center.city, center.barangay ?? ""].join(" ").toLowerCase().includes(needle)),
    );
    return origin
      ? results.sort((a, b) => calculateDistanceKm(origin, a) - calculateDistanceKm(origin, b))
      : results.sort((a, b) => a.city.localeCompare(b.city) || a.name.localeCompare(b.name));
  }, [centers, municipality, query, origin]);

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
      <p className="mt-2 max-w-3xl text-sm text-[var(--color-muted-foreground)]">These are sourced location references, not a live shelter occupancy feed. Confirm opening, space, and travel safety with the responsible LGU before going.</p>
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
    {locationMessage ? <p role="status" className="text-sm">{locationMessage}</p> : null}
    {loading ? <p role="status">Loading published centers…</p> : error ? <div role="alert"><p>{error}</p><button type="button" onClick={() => { setLoading(true); setError(null); setRefreshKey((value) => value + 1); }}>Retry</button></div> : (
      <>
        <div className="flex items-center justify-between gap-3"><p className="text-sm text-[var(--color-muted-foreground)]">{visibleCenters.length} published center{visibleCenters.length === 1 ? "" : "s"}</p><button type="button" onClick={() => { setLoading(true); setError(null); setRefreshKey((value) => value + 1); }} className="text-sm text-[var(--color-primary)]">Refresh</button></div>
        {visibleCenters.length === 0 ? <p className="rounded-xl border border-dashed border-[var(--color-border)] p-8 text-sm">No sourced evacuation center record is currently published{municipality ? ` for ${municipality}` : " for this selection"}. Contact your LGU or the Bulacan PDRRMO for current guidance.</p> : (
          <div className="grid gap-4 md:grid-cols-2">
            {visibleCenters.map((center) => <article key={center.id} id={`evacuation-center-${center.id}`} className={`rounded-xl border bg-[var(--color-surface)] p-5 ${selectedCenterId === center.id ? "border-[var(--color-primary)]" : "border-[var(--color-border)]"}`}>
              <h2 className="text-lg font-semibold">{center.name}</h2>
              <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{center.address}, {center.city}</p>
              {origin ? <p className="mt-2 text-sm">~{calculateDistanceKm(origin, center).toFixed(1)} km direct distance</p> : null}
              <p className="mt-3 text-sm font-semibold">{availabilityLabel(center)}</p>
              <p className="mt-1 text-sm">Location reference: {center.verificationStatus === "outdated" ? "stale" : "verified"} · Last checked {center.lastVerifiedAt ? formatLastVerified(center.lastVerifiedAt) : "unknown"}</p>
              {center.estimatedCapacity != null ? <p className="mt-1 text-sm">Estimated planning capacity: {center.estimatedCapacity}. Current occupancy unknown.</p> : null}
              <p className="mt-1 text-sm">{center.facilities.length ? `Reported facilities: ${center.facilities.join(", ").replaceAll("_", " ")}` : "Facilities not recorded"}</p>
              <div className="mt-3 text-sm">Source: {center.sourceName ?? "Official reference"} · <a href={center.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] underline">View source</a></div>
              <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold"><Link href={buildCenterMapHref(center.id)} className="text-[var(--color-primary)]">View on map</Link><a href={buildDirectionsUrl(center, origin)} target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)]">Directions</a></div>
            </article>)}
          </div>
        )}
      </>
    )}
  </main>;
}
