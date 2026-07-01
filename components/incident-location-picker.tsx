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
      <div className="flex h-full min-h-[300px] items-center justify-center rounded-xl border border-[color:color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[var(--color-panel)] text-[0.86rem] text-[var(--color-muted-foreground)] md:min-h-[320px] md:rounded-none md:border-0">
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
        className="fixed inset-0 z-[var(--layer-sheet)] flex items-end pt-[var(--header-height)] md:items-start md:justify-center md:px-6 md:pb-6 md:pt-[calc(var(--header-height)+1.25rem)]"
      >
        <div className="flex h-[calc(100dvh-var(--header-height))] max-h-[calc(100dvh-var(--header-height))] w-full flex-col overflow-hidden border border-[color:color-mix(in_srgb,var(--color-border)_76%,transparent)] bg-[var(--color-sidebar)] shadow-[var(--shadow-floating)] md:h-[min(88vh,820px)] md:max-h-none md:max-w-[1080px] md:rounded-[20px]">
          <div className="shrink-0 border-b border-[color:color-mix(in_srgb,var(--color-border)_72%,transparent)] px-4 py-3.5 md:px-5 md:py-4">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
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
                <p className="mt-1 max-w-[34rem] text-[0.8rem] leading-5 text-[var(--color-muted-foreground)] md:text-[0.82rem] md:leading-6">
                  Search for a place or tap the map to pin the exact flooded area.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close location picker"
                onClick={onClose}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] border border-[color:color-mix(in_srgb,var(--color-border)_76%,transparent)] bg-[var(--color-surface)] text-[var(--color-muted-foreground)] transition hover:text-[var(--color-foreground)] md:h-10 md:w-10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-5 md:grid md:grid-cols-[minmax(0,1fr)_320px] md:gap-0 md:overflow-hidden md:px-0 md:py-0">
            <div className="flex min-h-0 flex-col gap-3 md:gap-0 md:border-r md:border-[color:color-mix(in_srgb,var(--color-border)_68%,transparent)]">
              <div className="md:border-b md:border-[color:color-mix(in_srgb,var(--color-border)_68%,transparent)] md:px-5 md:py-3">
                <div className="flex flex-col gap-3 md:flex-row md:gap-2">
                  <label className="box-border flex h-[48px] min-h-[48px] w-full min-w-0 flex-1 items-center gap-3 rounded-xl border border-[color:color-mix(in_srgb,var(--color-border)_78%,var(--color-primary)_22%)] bg-[color:color-mix(in_srgb,var(--color-panel)_76%,black)] px-4 shadow-[inset_0_1px_0_color-mix(in_srgb,white_6%,transparent)] focus-within:border-[color:color-mix(in_srgb,var(--color-primary)_56%,transparent)] focus-within:ring-2 focus-within:ring-[color:color-mix(in_srgb,var(--color-primary)_18%,transparent)] md:h-11 md:min-h-11 md:gap-2.5 md:bg-[var(--color-surface)] md:px-3.5 md:shadow-none">
                    <Search className="h-5 w-5 shrink-0 text-[var(--color-muted-foreground)] opacity-75 md:h-4 md:w-4" />
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
                      className="h-full min-w-0 flex-1 truncate bg-transparent text-base leading-none text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted-foreground)] md:text-[0.9rem]"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleSearch()}
                    disabled={searching}
                    className="inline-flex h-[48px] min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 text-base font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70 md:h-11 md:min-h-11 md:w-auto md:rounded-[11px] md:text-[0.88rem]"
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

              <div className="h-[320px] min-h-[300px] w-full shrink-0 overflow-hidden rounded-xl border border-[color:color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[var(--color-map-shell)] md:min-h-0 md:flex-1 md:rounded-none md:border-0">
                <DynamicIncidentLocationPickerMap
                  selectedCoordinates={selectedCoordinates}
                  focusCoordinates={focusCoordinates}
                  onSelect={handleMapSelection}
                />
              </div>
            </div>

            <aside className="flex min-h-0 flex-col md:overflow-y-auto md:px-5 md:py-4">
              <div className="rounded-xl border border-[color:color-mix(in_srgb,var(--color-border)_74%,transparent)] bg-[color:color-mix(in_srgb,var(--color-panel)_82%,transparent)] px-3.5 py-3 md:rounded-[16px] md:px-4 md:py-4">
                <div className="flex items-center gap-2 text-[0.86rem] font-semibold text-[var(--color-foreground)] md:text-[0.9rem]">
                  <MapPin className="h-4 w-4 text-[var(--color-primary)]" />
                  <span>Selected location</span>
                </div>

                {selection ? (
                  <div className="mt-2.5 space-y-2.5 md:mt-3 md:space-y-3">
                    <div>
                      <div className="text-[0.72rem] font-medium text-[var(--color-muted-foreground)] md:text-[0.78rem]">
                        Place
                      </div>
                      <div className="mt-0.5 line-clamp-2 text-[0.84rem] leading-5 text-[var(--color-foreground)] md:mt-1 md:line-clamp-none md:text-[0.9rem] md:leading-6">
                        {selection.locationName}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
                      <div>
                        <div className="text-[0.7rem] font-medium text-[var(--color-muted-foreground)] md:text-[0.78rem]">
                          Latitude
                        </div>
                        <div className="mt-0.5 font-mono text-[0.8rem] tabular-nums text-[var(--color-foreground)] md:mt-1 md:text-[0.92rem]">
                          {selection.latitude.toFixed(6)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[0.7rem] font-medium text-[var(--color-muted-foreground)] md:text-[0.78rem]">
                          Longitude
                        </div>
                        <div className="mt-0.5 font-mono text-[0.8rem] tabular-nums text-[var(--color-foreground)] md:mt-1 md:text-[0.92rem]">
                          {selection.longitude.toFixed(6)}
                        </div>
                      </div>
                    </div>
                    {resolvingSelection ? (
                      <div className="text-[0.76rem] text-[var(--color-muted-foreground)] md:text-[0.8rem]">
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
                  <p className="mt-2 text-[0.8rem] leading-5 text-[var(--color-muted-foreground)] md:mt-3 md:text-[0.84rem] md:leading-6">
                    Search for a place or click the map to place a temporary marker.
                  </p>
                )}
              </div>

              <div className="mt-4 hidden rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4 md:block">
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

              <div className="mt-auto hidden flex-col gap-2 pt-4 md:flex lg:flex-row">
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

          <div className="flex shrink-0 items-center gap-3 border-t border-[color:color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[color:color-mix(in_srgb,var(--color-sidebar)_94%,transparent)] px-4 pb-[calc(env(safe-area-inset-bottom)+0.875rem)] pt-3 shadow-[0_-12px_28px_color-mix(in_srgb,var(--color-background)_28%,transparent)] backdrop-blur-md md:hidden">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 min-w-[104px] items-center justify-center rounded-xl border border-[color:color-mix(in_srgb,var(--color-border)_78%,transparent)] bg-[var(--color-surface)] px-4 text-[0.88rem] font-medium text-[var(--color-foreground)] transition hover:bg-[var(--color-panel)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!selection || resolvingSelection || searching}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-[var(--color-primary)] px-4 text-[0.88rem] font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {resolvingSelection
                ? "Resolving location..."
                : searching
                  ? "Please wait..."
                  : "Use this location"}
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
