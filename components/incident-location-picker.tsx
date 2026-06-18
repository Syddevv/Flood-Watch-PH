"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, MapPin, Search, X } from "lucide-react";

import { fetchWeatherLocation } from "@/lib/weather-client";

const DynamicIncidentLocationPickerMap = dynamic(
  () =>
    import("@/components/incident-location-picker-map").then(
      (mod) => mod.IncidentLocationPickerMap,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[320px] items-center justify-center rounded-[16px] border border-[var(--color-border)] bg-[var(--color-panel)] text-[0.88rem] text-[var(--color-muted-foreground)]">
        Loading map...
      </div>
    ),
  },
);

type PickedLocation = {
  locationName: string;
  latitude: string;
  longitude: string;
};

type SelectionState = {
  latitude: number;
  longitude: number;
  locationName: string;
};

type IncidentLocationPickerProps = {
  open: boolean;
  initialLocationName?: string;
  initialLatitude?: string;
  initialLongitude?: string;
  onClose: () => void;
  onConfirm: (location: PickedLocation) => void;
};

function buildFallbackLocationName(latitude: number, longitude: number) {
  return `Pinned location near ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

function isWithinPhilippines(latitude: number, longitude: number) {
  return latitude >= 4 && latitude <= 22.5 && longitude >= 116 && longitude <= 127.5;
}

export function IncidentLocationPicker({
  open,
  initialLocationName = "",
  initialLatitude = "",
  initialLongitude = "",
  onClose,
  onConfirm,
}: IncidentLocationPickerProps) {
  const parsedLatitude = Number(initialLatitude);
  const parsedLongitude = Number(initialLongitude);
  const initialCoordinates =
    Number.isFinite(parsedLatitude) &&
    Number.isFinite(parsedLongitude) &&
    isWithinPhilippines(parsedLatitude, parsedLongitude)
      ? {
          latitude: parsedLatitude,
          longitude: parsedLongitude,
        }
      : null;
  const initialSelection = initialCoordinates
    ? {
        latitude: initialCoordinates.latitude,
        longitude: initialCoordinates.longitude,
        locationName:
          initialLocationName.trim() ||
          buildFallbackLocationName(
            initialCoordinates.latitude,
            initialCoordinates.longitude,
          ),
      }
    : null;

  const [searchQuery, setSearchQuery] = useState(() => initialLocationName);
  const [selection, setSelection] = useState<SelectionState | null>(
    () => initialSelection,
  );
  const [focusCoordinates, setFocusCoordinates] = useState<{
    latitude: number;
    longitude: number;
  } | null>(() => initialCoordinates);
  const [searching, setSearching] = useState(false);
  const [resolvingSelection, setResolvingSelection] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [selectionWarning, setSelectionWarning] = useState<string | null>(null);
  const resolveRequestRef = useRef(0);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  const selectedCoordinates = useMemo(
    () =>
      selection
        ? {
            latitude: selection.latitude,
            longitude: selection.longitude,
          }
        : null,
    [selection],
  );

  if (!open) {
    return null;
  }

  async function resolveSelection(latitude: number, longitude: number) {
    const fallbackLocationName = buildFallbackLocationName(latitude, longitude);
    const requestId = resolveRequestRef.current + 1;
    resolveRequestRef.current = requestId;

    setResolvingSelection(true);
    setInlineError(null);
    setSelectionWarning(null);
    setSelection({
      latitude,
      longitude,
      locationName: fallbackLocationName,
    });

    try {
      const result = await fetchWeatherLocation({
        lat: latitude,
        lon: longitude,
        name: "Your Location",
      });
      const resolvedLocationName =
        result.resolvedAddress?.trim() ||
        result.location.name.trim() ||
        fallbackLocationName;

      if (resolveRequestRef.current !== requestId) {
        return;
      }

      setSelectionWarning(null);
      setSelection({
        latitude,
        longitude,
        locationName: resolvedLocationName,
      });
    } catch {
      if (resolveRequestRef.current !== requestId) {
        return;
      }

      setSelectionWarning(
        "Place name lookup failed. You can still use this pinned location and edit the location field later if needed.",
      );
      setSelection({
        latitude,
        longitude,
        locationName: fallbackLocationName,
      });
    } finally {
      if (resolveRequestRef.current === requestId) {
        setResolvingSelection(false);
      }
    }
  }

  async function handleSearch() {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) {
      setInlineError("Enter a place, street, barangay, city, or landmark.");
      return;
    }

    setSearching(true);
    setInlineError(null);
    setSelectionWarning(null);

    try {
      const result = await fetchWeatherLocation({ query: trimmedQuery });
      const nextSelection = {
        latitude: result.location.latitude,
        longitude: result.location.longitude,
        locationName:
          result.resolvedAddress?.trim() || result.location.name.trim() || trimmedQuery,
      };

      setSelection(nextSelection);
      setFocusCoordinates({
        latitude: nextSelection.latitude,
        longitude: nextSelection.longitude,
      });
    } catch (error) {
      setInlineError(
        error instanceof Error && error.message
          ? error.message
          : "Unable to find that location right now.",
      );
    } finally {
      setSearching(false);
    }
  }

  function handleMapSelection(latitude: number, longitude: number) {
    setFocusCoordinates({
      latitude,
      longitude,
    });
    setSearchQuery(buildFallbackLocationName(latitude, longitude));
    void resolveSelection(latitude, longitude);
  }

  function handleConfirm() {
    if (resolvingSelection || searching) {
      setInlineError("Please wait for the selected location to finish resolving.");
      return;
    }

    if (!selection) {
      setInlineError("Please select a location on the map first.");
      return;
    }

    onConfirm({
      locationName: selection.locationName,
      latitude: selection.latitude.toFixed(6),
      longitude: selection.longitude.toFixed(6),
    });
  }

  return (
    <>
      <div
        aria-hidden="true"
        className="floodwatch-scrim fixed inset-0 z-[var(--layer-sheet-backdrop)]"
        onClick={onClose}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="incident-location-picker-title"
        className="fixed inset-0 z-[var(--layer-sheet)] flex items-end md:items-start md:justify-center md:px-6 md:pb-6 md:pt-[calc(var(--header-height)+1.25rem)]"
      >
        <div className="flex h-[calc(100dvh-var(--header-height))] w-full flex-col overflow-hidden border border-[color:color-mix(in_srgb,var(--color-border)_76%,transparent)] bg-[var(--color-sidebar)] shadow-[var(--shadow-floating)] md:h-[min(88vh,820px)] md:max-w-[1080px] md:rounded-[20px]">
          <div className="border-b border-[color:color-mix(in_srgb,var(--color-border)_72%,transparent)] px-4 pb-3 pt-3 md:px-5 md:py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[0.78rem] font-medium text-[var(--color-muted-foreground)]">
                  Location picker
                </div>
                <h2
                  id="incident-location-picker-title"
                  className="mt-1 text-[1.05rem] font-semibold text-[var(--color-foreground)]"
                >
                  Pick flood location on the map
                </h2>
                <p className="mt-1 text-[0.82rem] leading-6 text-[var(--color-muted-foreground)]">
                  Search for a place or tap the map to pin the exact flooded area.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close location picker"
                onClick={onClose}
                className="inline-flex h-10 w-10 items-center justify-center rounded-[11px] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted-foreground)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 gap-0 md:grid-cols-[minmax(0,1fr)_320px]">
            <div className="order-2 flex min-h-[320px] flex-col border-t border-[color:color-mix(in_srgb,var(--color-border)_68%,transparent)] md:order-1 md:border-r md:border-t-0 md:min-h-0">
              <div className="border-b border-[color:color-mix(in_srgb,var(--color-border)_68%,transparent)] px-4 py-3 md:px-5">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-[11px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 focus-within:border-[color:color-mix(in_srgb,var(--color-primary)_42%,transparent)] focus-within:ring-2 focus-within:ring-[color:color-mix(in_srgb,var(--color-primary)_16%,transparent)]">
                    <Search className="h-4 w-4 shrink-0 text-[var(--color-muted-foreground)]" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void handleSearch();
                        }
                      }}
                      placeholder="Search barangay, street, city, or landmark"
                      className="w-full bg-transparent text-[0.9rem] text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted-foreground)]"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleSearch()}
                    disabled={searching}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-[11px] bg-[var(--color-primary)] px-4 text-[0.88rem] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {searching ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    <span>{searching ? "Searching..." : "Search"}</span>
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1">
                <DynamicIncidentLocationPickerMap
                  selectedCoordinates={selectedCoordinates}
                  focusCoordinates={focusCoordinates}
                  onSelect={handleMapSelection}
                />
              </div>
            </div>

            <aside className="order-1 flex min-h-0 flex-col px-4 py-4 md:order-2 md:px-5">
              <div className="rounded-[16px] border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-4">
                <div className="flex items-center gap-2 text-[0.9rem] font-semibold text-[var(--color-foreground)]">
                  <MapPin className="h-4 w-4 text-[var(--color-primary)]" />
                  <span>Selected location</span>
                </div>

                {selection ? (
                  <div className="mt-3 space-y-3">
                    <div>
                      <div className="text-[0.78rem] font-medium text-[var(--color-muted-foreground)]">
                        Place
                      </div>
                      <div className="mt-1 text-[0.9rem] leading-6 text-[var(--color-foreground)]">
                        {selection.locationName}
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-1">
                      <div>
                        <div className="text-[0.78rem] font-medium text-[var(--color-muted-foreground)]">
                          Latitude
                        </div>
                        <div className="mt-1 font-mono text-[0.92rem] tabular-nums text-[var(--color-foreground)]">
                          {selection.latitude.toFixed(6)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[0.78rem] font-medium text-[var(--color-muted-foreground)]">
                          Longitude
                        </div>
                        <div className="mt-1 font-mono text-[0.92rem] tabular-nums text-[var(--color-foreground)]">
                          {selection.longitude.toFixed(6)}
                        </div>
                      </div>
                    </div>
                    {resolvingSelection ? (
                      <div className="text-[0.8rem] text-[var(--color-muted-foreground)]">
                        Resolving nearby place name...
                      </div>
                    ) : null}
                    {selectionWarning ? (
                      <div className="rounded-[12px] border border-[var(--color-warning-border)] bg-[var(--color-warning-surface)] px-3 py-2 text-[0.78rem] leading-5 text-[var(--color-warning-text)]">
                        {selectionWarning}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-3 text-[0.84rem] leading-6 text-[var(--color-muted-foreground)]">
                    Search for a place or click the map to place a temporary marker.
                  </p>
                )}
              </div>

              <div className="mt-4 rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4">
                <div className="text-[0.88rem] font-semibold text-[var(--color-foreground)]">
                  How to use
                </div>
                <ol className="mt-3 space-y-2 text-[0.82rem] leading-6 text-[var(--color-muted-foreground)]">
                  <li>1. Search for the area or move around the map manually.</li>
                  <li>2. Tap the exact flood location to place the marker.</li>
                  <li>3. Drag the marker if you need a more precise spot.</li>
                  <li>4. Confirm the pin to fill the incident form.</li>
                </ol>
              </div>

              {inlineError ? (
                <div className="mt-4 rounded-[14px] border border-[var(--color-danger-border)] bg-[var(--color-danger-surface)] px-3.5 py-3 text-[0.82rem] text-[var(--color-danger-text)]">
                  {inlineError}
                </div>
              ) : null}

              <div className="mt-auto flex flex-col gap-2 pt-4 sm:flex-row md:flex-col lg:flex-row">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-11 items-center justify-center rounded-[11px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-[0.88rem] font-medium text-[var(--color-foreground)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!selection || resolvingSelection || searching}
                  className="inline-flex h-11 items-center justify-center rounded-[11px] bg-[var(--color-primary)] px-4 text-[0.88rem] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {resolvingSelection
                    ? "Resolving location..."
                    : searching
                      ? "Please wait..."
                      : "Use this location"}
                </button>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}
