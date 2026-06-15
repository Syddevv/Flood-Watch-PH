"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Accessibility,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Droplets,
  LoaderCircle,
  MapPinned,
  Phone,
  Search,
  ShieldPlus,
  Sparkles,
  Toilet,
} from "lucide-react";

import {
  EMERGENCY_RESOURCE_CONTACTS,
  EVACUATION_CENTERS,
  EVACUATION_CENTER_FACILITIES,
  FLOOD_SAFETY_CHECKLIST,
} from "@/lib/constants";
import {
  buildCenterMapHref,
  buildDirectionsUrl,
  calculateDistanceKm,
  EMERGENCY_CONTACT_CATEGORY_ACCENTS,
  EVACUATION_STATUS_META,
  formatDistanceKm,
  formatLastVerified,
} from "@/lib/emergency-resources";
import type {
  EvacuationCenterResource,
  EvacuationCenterStatus,
  EvacuationFacility,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_FILTERS: Array<"All" | EvacuationCenterStatus> = [
  "All",
  "Available",
  "Standby",
  "Needs Verification",
  "Temporarily Unavailable",
];

const FACILITY_ICONS: Record<EvacuationFacility, ReactNode> = {
  "PWD Accessible": <Accessibility className="h-3.5 w-3.5" />,
  "Medical Support": <ShieldPlus className="h-3.5 w-3.5" />,
  "Drinking Water": <Droplets className="h-3.5 w-3.5" />,
  Restrooms: <Toilet className="h-3.5 w-3.5" />,
  "Pet Friendly": <Sparkles className="h-3.5 w-3.5" />,
  Parking: <MapPinned className="h-3.5 w-3.5" />,
};

type NearestCenterResult = {
  center: EvacuationCenterResource;
  distanceKm: number;
};

function EvacuationCenterCard({
  center,
  highlighted,
}: {
  center: EvacuationCenterResource;
  highlighted: boolean;
}) {
  const statusMeta = EVACUATION_STATUS_META[center.status];

  return (
    <article
      className={cn(
        "rounded-[22px] border bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)]",
        highlighted
          ? "border-[var(--color-primary)] shadow-[0_0_0_1px_rgba(37,99,235,0.2),var(--shadow-soft)]"
          : "border-[var(--color-border)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[1rem] font-semibold tracking-[-0.02em] text-[var(--color-foreground)]">
            {center.name}
          </h2>
          <div className="mt-1 text-[0.88rem] text-[var(--color-muted-foreground)]">
            {center.address}
          </div>
          <div className="mt-1 text-[0.82rem] text-[var(--color-muted-foreground)]">
            {center.barangay}, {center.cityOrMunicipality}, {center.province}
          </div>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-3 py-1 text-[0.7rem] font-semibold",
            statusMeta.badgeClassName,
          )}
        >
          {center.status}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {center.facilities.map((facility) => (
          <span
            key={facility}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-panel)] px-2.5 py-1 text-[0.74rem] font-medium text-[var(--color-foreground)]"
          >
            {FACILITY_ICONS[facility]}
            <span>{facility}</span>
          </span>
        ))}
      </div>

      <div className="mt-3 space-y-2 text-[0.84rem] text-[var(--color-muted-foreground)]">
        {center.contactNumber ? (
          <div className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 text-[var(--color-primary)]" />
            <span>{center.contactNumber}</span>
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-success)]" />
          <span>Last verified {formatLastVerified(center.lastVerifiedAt)}</span>
        </div>
        {center.estimatedCapacity ? (
          <div className="flex items-center gap-2">
            <MapPinned className="h-3.5 w-3.5 text-[var(--color-primary)]" />
            <span>Estimated Capacity: {center.estimatedCapacity}</span>
          </div>
        ) : null}
      </div>

      {center.notes ? (
        <p className="mt-3 rounded-[16px] bg-[var(--color-panel)] px-3.5 py-3 text-[0.84rem] leading-6 text-[var(--color-foreground)]">
          {center.notes}
        </p>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <Link
          href={buildCenterMapHref(center.id)}
          className="inline-flex h-10 items-center justify-center rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-[0.88rem] font-medium text-[var(--color-foreground)]"
        >
          View on Map
        </Link>
        <a
          href={buildDirectionsUrl(center)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center justify-center rounded-[12px] bg-[var(--color-primary)] px-4 text-[0.88rem] font-semibold text-white"
        >
          Get Directions
        </a>
      </div>
    </article>
  );
}

function NearestCenterCard({
  nearest,
  suggestions,
}: {
  nearest: NearestCenterResult;
  suggestions: NearestCenterResult[];
}) {
  const statusMeta = EVACUATION_STATUS_META[nearest.center.status];

  return (
    <section className="rounded-[22px] border border-[rgba(37,99,235,0.28)] bg-[linear-gradient(135deg,rgba(14,28,52,0.96),rgba(26,43,75,0.98))] p-4 text-white shadow-[var(--shadow-soft)]">
      <div className="flex items-center gap-2 text-[0.76rem] font-semibold uppercase tracking-[0.1em] text-sky-300">
        <Crosshair className="h-4 w-4" />
        <span>Nearest evacuation center</span>
      </div>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[1.1rem] font-semibold tracking-[-0.02em] text-white">
            {nearest.center.name}
          </h2>
          <div className="mt-1 text-[0.88rem] text-slate-300">
            {nearest.center.address}
          </div>
          <div className="mt-1 text-[0.8rem] text-slate-400">
            {nearest.center.barangay}, {nearest.center.cityOrMunicipality}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[1.2rem] font-semibold text-white">
            {formatDistanceKm(nearest.distanceKm)}
          </div>
          <div className="text-[0.76rem] text-slate-400">from your location</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded-full border px-3 py-1 text-[0.72rem] font-semibold",
            statusMeta.badgeClassName,
          )}
        >
          {nearest.center.status}
        </span>
        <span className="text-[0.78rem] text-slate-300">
          Last verified {formatLastVerified(nearest.center.lastVerifiedAt)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {nearest.center.facilities.slice(0, 4).map((facility) => (
          <span
            key={facility}
            className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(148,163,184,0.24)] bg-[rgba(15,23,42,0.42)] px-2.5 py-1 text-[0.74rem] font-medium text-slate-100"
          >
            {FACILITY_ICONS[facility]}
            <span>{facility}</span>
          </span>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <Link
          href={buildCenterMapHref(nearest.center.id)}
          className="inline-flex h-10 items-center justify-center rounded-[12px] border border-[rgba(148,163,184,0.28)] bg-[rgba(15,23,42,0.36)] px-4 text-[0.88rem] font-medium text-white"
        >
          View on Map
        </Link>
        <a
          href={buildDirectionsUrl(nearest.center)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center justify-center rounded-[12px] bg-[var(--color-primary)] px-4 text-[0.88rem] font-semibold text-white"
        >
          Get Directions
        </a>
      </div>

      {suggestions.length > 0 ? (
        <div className="mt-4 border-t border-[rgba(148,163,184,0.18)] pt-4">
          <div className="text-[0.76rem] font-semibold uppercase tracking-[0.08em] text-slate-400">
            Next nearest centers
          </div>
          <div className="mt-2 grid gap-2">
            {suggestions.map((entry) => (
              <div
                key={entry.center.id}
                className="flex items-center justify-between rounded-[14px] border border-[rgba(148,163,184,0.18)] bg-[rgba(15,23,42,0.28)] px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-[0.84rem] font-medium text-slate-100">
                    {entry.center.name}
                  </div>
                  <div className="truncate text-[0.74rem] text-slate-400">
                    {entry.center.cityOrMunicipality}
                  </div>
                </div>
                <div className="text-[0.8rem] font-semibold text-sky-300">
                  {formatDistanceKm(entry.distanceKm)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function EvacuationCentersContent() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | EvacuationCenterStatus>("All");
  const [facilityFilter, setFacilityFilter] = useState<"All" | EvacuationFacility>("All");
  const [highlightedCenterId, setHighlightedCenterId] = useState<string | null>(null);
  const [checklistExpanded, setChecklistExpanded] = useState(false);
  const [isFindingNearest, setIsFindingNearest] = useState(false);
  const [nearestResults, setNearestResults] = useState<NearestCenterResult[]>([]);
  const [nearestMessage, setNearestMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      setHighlightedCenterId(new URLSearchParams(window.location.search).get("center"));
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  const filteredCenters = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return EVACUATION_CENTERS.filter((center) => {
      const matchesQuery = normalizedQuery
        ? [
            center.name,
            center.address,
            center.barangay,
            center.cityOrMunicipality,
            center.province,
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery)
        : true;

      const matchesStatus = statusFilter === "All" || center.status === statusFilter;
      const matchesFacility =
        facilityFilter === "All" || center.facilities.includes(facilityFilter);

      return matchesQuery && matchesStatus && matchesFacility;
    });
  }, [facilityFilter, query, statusFilter]);

  const visibleChecklistItems = useMemo(
    () =>
      checklistExpanded
        ? FLOOD_SAFETY_CHECKLIST
        : FLOOD_SAFETY_CHECKLIST.slice(0, 4),
    [checklistExpanded],
  );

  const nearestCenter = nearestResults[0] ?? null;
  const nextNearestCenters = nearestResults.slice(1, 3);
  const activeHighlightedCenterId = highlightedCenterId ?? nearestCenter?.center.id ?? null;

  function handleFacilityFilterSelect(facility: EvacuationFacility) {
    setFacilityFilter((current) => (current === facility ? "All" : facility));
  }

  function handleFindNearestCenter() {
    if (EVACUATION_CENTERS.length === 0) {
      setNearestMessage("No evacuation centers found from the current data.");
      setNearestResults([]);
      return;
    }

    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setNearestMessage("Your browser does not support location detection.");
      setNearestResults([]);
      return;
    }

    setIsFindingNearest(true);
    setNearestMessage("Finding nearest evacuation center...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const origin = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };

        const rankedCenters = EVACUATION_CENTERS.map((center) => ({
          center,
          distanceKm: calculateDistanceKm(origin, {
            latitude: center.latitude,
            longitude: center.longitude,
          }),
        })).sort((left, right) => left.distanceKm - right.distanceKm);

        setNearestResults(rankedCenters);
        setNearestMessage(null);
        setIsFindingNearest(false);
      },
      (error) => {
        const denied =
          error.code === error.PERMISSION_DENIED
            ? "Location access was denied. You can still search by city, barangay, or province."
            : "Unable to detect your location right now. You can still search by city, barangay, or province.";

        setNearestMessage(denied);
        setNearestResults([]);
        setIsFindingNearest(false);
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000,
      },
    );
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-[var(--color-background)] [scrollbar-gutter:stable]">
      <div className="mx-auto flex min-h-full w-full max-w-[1480px] flex-col gap-5 px-4 py-5 md:px-6 md:py-6 xl:px-8">
        <section className="rounded-[24px] border border-[var(--color-border)] bg-[linear-gradient(135deg,rgba(9,16,31,0.94),rgba(16,28,53,0.96))] p-5 shadow-[var(--shadow-soft)]">
          <div className="flex items-center gap-2 text-[0.78rem] font-semibold uppercase tracking-[0.1em] text-sky-300">
            <MapPinned className="h-4 w-4" />
            <span>Public Emergency Resource Hub</span>
          </div>
          <h1 className="mt-3 text-[2rem] font-semibold tracking-[-0.04em] text-white">
            Evacuation Centers & Emergency Resources
          </h1>
          <p className="mt-2 max-w-[820px] text-[0.96rem] leading-7 text-slate-300">
            Find evacuation centers, emergency contacts, and flood safety guidance in one
            public-facing page. Center information below uses static seeded data so people
            can plan quickly even when live occupancy systems are unavailable.
          </p>

          <div className="mt-4 rounded-[18px] border border-[rgba(56,189,248,0.24)] bg-[rgba(15,23,42,0.52)] px-4 py-3 text-[0.88rem] leading-6 text-slate-200">
            Evacuation center details may change during emergencies. Always confirm with
            your LGU, barangay, or emergency response office before going.
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.95fr)]">
          <section className="min-w-0 space-y-4">
            <div className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)]">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <label className="flex h-11 flex-1 items-center gap-3 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-panel)] px-4">
                    <Search className="h-4 w-4 text-[var(--color-muted-foreground)]" />
                    <input
                      type="search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search by center, barangay, city, or province..."
                      className="w-full bg-transparent text-[0.92rem] text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted-foreground)]"
                    />
                  </label>

                  <div className="flex flex-col gap-2 xl:items-end">
                    <button
                      type="button"
                      onClick={handleFindNearestCenter}
                      disabled={isFindingNearest}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-[12px] bg-[var(--color-primary)] px-4 text-[0.86rem] font-semibold text-white disabled:opacity-70"
                    >
                      {isFindingNearest ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <Crosshair className="h-4 w-4" />
                      )}
                      <span>Evacuation Center Near Me</span>
                    </button>
                    <p className="text-[0.74rem] text-[var(--color-muted-foreground)]">
                      Your location is only used in your browser to find nearby evacuation centers.
                    </p>
                  </div>
                </div>

                {nearestMessage ? (
                  <div
                    className={cn(
                      "rounded-[14px] px-3.5 py-3 text-[0.82rem]",
                      isFindingNearest
                        ? "border border-[rgba(37,99,235,0.22)] bg-[rgba(37,99,235,0.08)] text-[var(--color-primary)]"
                        : "border border-[rgba(245,158,11,0.28)] bg-[rgba(245,158,11,0.08)] text-[var(--color-warning)]",
                    )}
                  >
                    {nearestMessage}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {STATUS_FILTERS.map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setStatusFilter(status)}
                      className={cn(
                        "rounded-full px-3.5 py-2 text-[0.78rem] font-semibold transition",
                        statusFilter === status
                          ? "bg-[var(--color-primary)] text-white"
                          : "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]",
                      )}
                    >
                      {status}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setFacilityFilter("All")}
                    className={cn(
                      "rounded-full border px-3.5 py-2 text-[0.78rem] font-semibold transition",
                      facilityFilter === "All"
                        ? "border-[rgba(37,99,235,0.2)] bg-[rgba(37,99,235,0.08)] text-[var(--color-primary)]"
                        : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]",
                    )}
                  >
                    All Facilities
                  </button>
                  {EVACUATION_CENTER_FACILITIES.map((facility) => (
                    <button
                      key={facility}
                      type="button"
                      onClick={() => handleFacilityFilterSelect(facility)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[0.78rem] font-semibold transition",
                        facilityFilter === facility
                          ? "border-[rgba(37,99,235,0.3)] bg-[rgba(37,99,235,0.1)] text-[var(--color-primary)]"
                          : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]",
                      )}
                    >
                      {FACILITY_ICONS[facility]}
                      <span>{facility}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {nearestCenter ? (
              <NearestCenterCard
                nearest={nearestCenter}
                suggestions={nextNearestCenters}
              />
            ) : null}

            <div className="grid gap-4 lg:grid-cols-2">
              {filteredCenters.map((center) => (
                <EvacuationCenterCard
                  key={center.id}
                  center={center}
                  highlighted={activeHighlightedCenterId === center.id}
                />
              ))}
            </div>

            {filteredCenters.length === 0 ? (
              <div className="rounded-[20px] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-6 text-[0.9rem] text-[var(--color-muted-foreground)]">
                No evacuation centers matched the current search and filter settings.
              </div>
            ) : null}

            <section className="rounded-[20px] border border-[rgba(56,189,248,0.18)] bg-[rgba(15,23,42,0.72)] p-4 shadow-[var(--shadow-soft)] xl:hidden">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sky-300">
                    <AlertTriangle className="h-4 w-4" />
                    <h2 className="text-[1rem] font-semibold text-white">
                      Flood Safety Checklist
                    </h2>
                  </div>
                  <p className="mt-1 text-[0.8rem] text-slate-400">
                    Quick reminders during flood situations.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setChecklistExpanded((current) => !current)}
                  className="inline-flex items-center gap-1 rounded-full border border-[rgba(148,163,184,0.2)] px-3 py-1.5 text-[0.74rem] font-semibold text-slate-200"
                >
                  <span>{checklistExpanded ? "Show less" : "Show more"}</span>
                  {checklistExpanded ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>

              <ul className="mt-3 space-y-2">
                {visibleChecklistItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start gap-2.5 text-[0.82rem] leading-5.5 text-slate-100"
                  >
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            </section>
          </section>

          <aside className="space-y-4">
            <section className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)]">
              <h2 className="text-[1.06rem] font-semibold text-[var(--color-foreground)]">
                Emergency Contacts
              </h2>
              <p className="mt-1 text-[0.86rem] leading-6 text-[var(--color-muted-foreground)]">
                Contact numbers may vary by location. For immediate life-threatening
                emergencies, contact your local emergency hotline or authorities.
              </p>

              <div className="mt-4 space-y-3">
                {EMERGENCY_RESOURCE_CONTACTS.map((contact) => (
                  <article
                    key={contact.id}
                    className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-panel)] p-3.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-[0.94rem] font-semibold text-[var(--color-foreground)]">
                          {contact.name}
                        </h3>
                        <div
                          className={cn(
                            "mt-1 text-[0.72rem] font-semibold uppercase tracking-[0.08em]",
                            EMERGENCY_CONTACT_CATEGORY_ACCENTS[contact.category],
                          )}
                        >
                          {contact.category}
                        </div>
                      </div>
                      {contact.isSample ? (
                        <span className="rounded-full border border-[rgba(245,158,11,0.28)] bg-[rgba(245,158,11,0.1)] px-2.5 py-1 text-[0.66rem] font-semibold text-[var(--color-warning)]">
                          Sample / Demo
                        </span>
                      ) : null}
                    </div>

                    {contact.phone ? (
                      <div className="mt-3 text-[0.94rem] font-semibold text-[var(--color-primary)]">
                        {contact.phone}
                      </div>
                    ) : null}
                    {contact.coverage ? (
                      <div className="mt-1 text-[0.78rem] text-[var(--color-muted-foreground)]">
                        {contact.coverage}
                      </div>
                    ) : null}
                    <p className="mt-2 text-[0.82rem] leading-6 text-[var(--color-muted-foreground)]">
                      {contact.note}
                    </p>

                    {contact.callHref ? (
                      <a
                        href={contact.callHref}
                        className="mt-3 inline-flex h-9 items-center justify-center rounded-[11px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-[0.82rem] font-semibold text-[var(--color-foreground)]"
                      >
                        Call
                      </a>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>

            <section className="hidden rounded-[20px] border border-[rgba(56,189,248,0.18)] bg-[rgba(15,23,42,0.72)] p-4 shadow-[var(--shadow-soft)] xl:block">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sky-300">
                    <AlertTriangle className="h-4 w-4" />
                    <h2 className="text-[1rem] font-semibold text-white">
                      Flood Safety Checklist
                    </h2>
                  </div>
                  <p className="mt-1 text-[0.8rem] text-slate-400">
                    Quick reminders during flood situations.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setChecklistExpanded((current) => !current)}
                  className="inline-flex items-center gap-1 rounded-full border border-[rgba(148,163,184,0.2)] px-3 py-1.5 text-[0.74rem] font-semibold text-slate-200"
                >
                  <span>{checklistExpanded ? "Show less" : "Show more"}</span>
                  {checklistExpanded ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>

              <ul className="mt-3 space-y-2">
                {visibleChecklistItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start gap-2.5 text-[0.82rem] leading-5.5 text-slate-100"
                  >
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>

        <div className="h-20 md:hidden" />
      </div>
    </div>
  );
}
