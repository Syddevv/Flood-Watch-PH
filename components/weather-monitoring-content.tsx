"use client";

import { useEffect, useRef, useState } from "react";
import {
  CloudRain,
  ExternalLink,
  LoaderCircle,
  LocateFixed,
  MapPin,
  Search,
  TriangleAlert,
} from "lucide-react";

import { AlertCard } from "@/components/alert-card";
import { severityBadgeClasses } from "@/lib/report-ui";
import type {
  AlertSeverity,
  FloodRiskLevel,
  WeatherLocation,
  WeatherLocationResult,
  WeatherOverviewData,
  WeatherSourcesData,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { fetchWeatherLocation, fetchWeatherSources } from "@/lib/weather-client";

type WeatherMonitoringContentProps = {
  weather: WeatherOverviewData;
  weatherLoading: boolean;
  weatherError: string | null;
};

function formatTemperature(temperature: number | null) {
  return temperature === null ? "--" : `${temperature.toFixed(1)}°C`;
}

function formatPrecipitation(precipitation: number | null) {
  return precipitation === null ? "Unavailable" : `${precipitation.toFixed(1)} mm/hr`;
}

function formatHumidity(humidity: number | null) {
  return humidity === null ? "Unavailable" : `${humidity.toFixed(0)}%`;
}

function formatWindSpeed(windSpeed: number | null) {
  return windSpeed === null ? "Unavailable" : `${windSpeed.toFixed(1)} km/h`;
}

function getSeverityTone(riskLevel: FloodRiskLevel): AlertSeverity {
  if (riskLevel === "Critical") {
    return "severe";
  }

  if (riskLevel === "High") {
    return "high";
  }

  if (riskLevel === "Moderate") {
    return "moderate";
  }

  return "safe";
}

function SelectedLocationWeatherCard({
  result,
  title,
}: {
  result: WeatherLocationResult;
  title: string;
}) {
  const { location, fetchedAt, advisoryMessage } = result;

  return (
    <section className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-5 shadow-[var(--shadow-soft)]">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="rounded-[18px] bg-[var(--color-panel)] p-3 text-[var(--color-primary)]">
            <CloudRain className="h-12 w-12" strokeWidth={1.9} />
          </div>
          <div>
            <div className="text-[0.74rem] font-semibold tracking-[0.06em] text-[var(--color-section-heading)]">
              {title}
            </div>
            <div className="mt-1 text-[1.3rem] font-semibold text-[var(--color-foreground)]">
              {location.name}
            </div>
            <div className="mt-1 text-[0.92rem] text-[var(--color-muted-foreground)]">
              {location.condition ?? "Weather conditions unavailable"}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded-full border px-2.5 py-1 text-[0.7rem] font-semibold",
              severityBadgeClasses[getSeverityTone(location.riskLevel)],
            )}
          >
            {location.riskLevel}
          </span>
          <span className="text-[0.76rem] text-[var(--color-muted-foreground)]">
            Updated {fetchedAt}
          </span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Temperature" value={formatTemperature(location.temperature)} />
        <MetricCard label="Precipitation" value={formatPrecipitation(location.precipitation)} />
        <MetricCard label="Humidity" value={formatHumidity(location.humidity)} />
        <MetricCard label="Wind Speed" value={formatWindSpeed(location.windSpeed)} />
        <MetricCard label="Source" value={location.source.name} />
      </div>

      <div className="mt-4 space-y-1 text-[0.76rem] text-[var(--color-muted-foreground)]">
        <div>
          Official reference:{" "}
          <span className="font-medium text-[var(--color-foreground)]">
            {location.officialReference.label ?? location.officialReference.name}
          </span>
        </div>
        <div>{advisoryMessage}</div>
      </div>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-[16px] border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-3">
      <div className="text-[0.75rem] text-[var(--color-muted-foreground)]">{label}</div>
      <div className="mt-1 text-[0.98rem] font-semibold text-[var(--color-foreground)]">{value}</div>
    </article>
  );
}

function MonitoredLocationCard({ location }: { location: WeatherLocation }) {
  return (
    <article className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3.5 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[0.95rem] font-semibold text-[var(--color-foreground)]">
            {location.name}
          </div>
          <div className="mt-1 text-[0.8rem] text-[var(--color-muted-foreground)]">
            {location.condition ?? "Weather conditions unavailable"}
          </div>
        </div>
        <span
          className={cn(
            "rounded-full border px-2.5 py-1 text-[0.65rem] font-semibold",
            severityBadgeClasses[getSeverityTone(location.riskLevel)],
          )}
        >
          {location.riskLevel}
        </span>
      </div>

      <div className="mt-4 text-[1.3rem] font-semibold text-[var(--color-foreground)]">
        {formatTemperature(location.temperature)}
      </div>

      <div className="mt-3 space-y-2 text-[0.82rem] text-[var(--color-muted-foreground)]">
        <div>Precipitation: {formatPrecipitation(location.precipitation)}</div>
        <div>Humidity: {formatHumidity(location.humidity)}</div>
        <div>Wind speed: {formatWindSpeed(location.windSpeed)}</div>
      </div>

      <div className="mt-3 text-[0.74rem] text-[var(--color-muted-foreground)]">
        Last updated {location.updatedAt}
      </div>
      <div className="mt-1 text-[0.72rem] text-[var(--color-muted-foreground)]">
        Source: {location.source.name}
      </div>
      <div className="mt-1 text-[0.72rem] text-[var(--color-muted-foreground)]">
        Official reference: {location.officialReference.name}
      </div>
    </article>
  );
}

function OfficialAdvisoriesSection({
  weatherSources,
  advisoryMessage,
}: {
  weatherSources: WeatherSourcesData | null;
  advisoryMessage: string;
}) {
  return (
    <section className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4 shadow-[var(--shadow-soft)]">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-[1.1rem] font-semibold tracking-[-0.03em] text-[var(--color-foreground)]">
            Official Advisories
          </h2>
          <p className="mt-1 text-[0.84rem] text-[var(--color-muted-foreground)]">
            {weatherSources?.advisoryMessage ?? advisoryMessage}
          </p>
        </div>
        <div className="rounded-full border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-1 text-[0.72rem] text-[var(--color-muted-foreground)]">
          Live weather data: Open-Meteo
        </div>
      </div>

      {weatherSources ? (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            {weatherSources.links.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-1.5 text-[0.78rem] font-medium text-[var(--color-foreground)]"
              >
                <span>{link.title}</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ))}
          </div>
          <p className="mt-3 text-[0.78rem] text-[var(--color-muted-foreground)]">
            {weatherSources.shortAdvisoryMessage}
          </p>
        </>
      ) : (
        <div className="mt-3 text-[0.78rem] text-[var(--color-muted-foreground)]">
          Loading official reference links...
        </div>
      )}
    </section>
  );
}

export function WeatherMonitoringContent({
  weather,
  weatherLoading,
  weatherError,
}: WeatherMonitoringContentProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocationResult, setSelectedLocationResult] = useState<WeatherLocationResult | null>(null);
  const [selectedLocationTitle, setSelectedLocationTitle] = useState("Selected Location Weather");
  const [searchLoading, setSearchLoading] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationActionMessage, setLocationActionMessage] = useState<string | null>(null);
  const [weatherSources, setWeatherSources] = useState<WeatherSourcesData | null>(null);
  const locationAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();

    async function loadWeatherSources() {
      try {
        const nextWeatherSources = await fetchWeatherSources(abortController.signal);

        if (isMounted) {
          setWeatherSources(nextWeatherSources);
        }
      } catch (error) {
        if (!isMounted || abortController.signal.aborted) {
          return;
        }

        console.error("Failed to load weather sources.", error);
      }
    }

    loadWeatherSources();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, []);

  async function loadSelectedLocation(
    params: { query: string } | { lat: number; lon: number; name?: string },
    loadingMessage: string,
    failureMessage: string,
    title: string,
  ) {
    locationAbortRef.current?.abort();
    const abortController = new AbortController();
    locationAbortRef.current = abortController;
    setLocationActionMessage(loadingMessage);

    try {
      const result = await fetchWeatherLocation(params, abortController.signal);
      setSelectedLocationResult(result);
      setSelectedLocationTitle(title);
      setLocationActionMessage(null);
    } catch (error) {
      if (abortController.signal.aborted) {
        return;
      }

      console.error("Failed to load selected weather location.", error);
      setLocationActionMessage(
        error instanceof Error && error.message ? error.message : failureMessage,
      );
    }
  }

  async function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedQuery = searchQuery.trim();

    if (!trimmedQuery) {
      setLocationActionMessage("Location not found. Try another city, municipality, or province.");
      return;
    }

    setSearchLoading(true);

    try {
      await loadSelectedLocation(
        { query: trimmedQuery },
        "Searching weather location...",
        "Unable to load weather for this location. Please try again.",
        "Selected Location Weather",
      );
    } finally {
      setSearchLoading(false);
    }
  }

  async function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setLocationActionMessage("Unable to detect your location. Please search manually.");
      return;
    }

    setDetectingLocation(true);
    setLocationActionMessage("Detecting your location...");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await loadSelectedLocation(
            {
              lat: position.coords.latitude,
              lon: position.coords.longitude,
              name: "Your Location",
            },
            "Detecting your location...",
            "Unable to detect your location. Please search manually.",
            "Your Location Weather",
          );
        } finally {
          setDetectingLocation(false);
        }
      },
      (error) => {
        setDetectingLocation(false);

        if (error.code === error.PERMISSION_DENIED) {
          setLocationActionMessage(
            "Location access was denied. You can still search for your city or municipality.",
          );
          return;
        }

        setLocationActionMessage("Unable to detect your location. Please search manually.");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-[var(--color-background)]">
      <div className="mx-auto flex min-h-full w-full max-w-[1180px] flex-col gap-4 px-4 py-5 md:px-6 md:py-6">
        <section>
          <h1 className="text-[2rem] font-semibold tracking-[-0.03em] text-[var(--color-foreground)]">
            Weather Monitoring
          </h1>
          <p className="mt-1.5 text-[0.95rem] text-[var(--color-muted-foreground)]">
            Search weather for places in the Philippines or use your current location, while keeping monitored flood-prone areas in view.
          </p>
        </section>

        <section className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-5 shadow-[var(--shadow-soft)]">
          <form
            onSubmit={handleSearchSubmit}
            className="flex flex-col gap-3 lg:flex-row lg:items-center"
          >
            <label className="flex min-h-12 min-w-0 flex-1 items-center gap-2.5 rounded-full border border-[var(--color-border)] bg-[var(--color-panel)] px-4">
              <Search className="h-4 w-4 text-[var(--color-muted-foreground)]" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search a city, municipality, province, or barangay"
                className="w-full bg-transparent py-3 text-[0.92rem] text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted-foreground)]"
              />
            </label>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={searchLoading || detectingLocation}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] px-5 text-[0.86rem] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
              >
                {searchLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                <span>{searchLoading ? "Searching..." : "Search Weather"}</span>
              </button>

              <button
                type="button"
                onClick={handleUseMyLocation}
                disabled={searchLoading || detectingLocation}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-panel)] px-5 text-[0.86rem] font-semibold text-[var(--color-foreground)] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {detectingLocation ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <LocateFixed className="h-4 w-4" />
                )}
                <span>Use My Location</span>
              </button>
            </div>
          </form>

          {locationActionMessage ? (
            <div className="mt-4 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-2.5 text-[0.84rem] text-[var(--color-muted-foreground)]">
              {locationActionMessage}
            </div>
          ) : null}
        </section>

        {selectedLocationResult ? (
          <SelectedLocationWeatherCard
            result={selectedLocationResult}
            title={selectedLocationTitle}
          />
        ) : null}

        <OfficialAdvisoriesSection
          weatherSources={weatherSources}
          advisoryMessage={weather.advisoryMessage}
        />

        {weatherLoading ? (
          <section className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-5 shadow-[var(--shadow-soft)] text-[0.95rem] text-[var(--color-muted-foreground)]">
            Loading weather data...
          </section>
        ) : weatherError ? (
          <section className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-5 shadow-[var(--shadow-soft)] text-[0.95rem] text-[var(--color-muted-foreground)]">
            {weatherError}
          </section>
        ) : (
          <>
            <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)]">
              <div className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-5 shadow-[var(--shadow-soft)]">
                <div>
                  <h2 className="text-[1.5rem] font-semibold tracking-[-0.03em] text-[var(--color-foreground)]">
                    Official / System Flood Alerts
                  </h2>
                  <p className="mt-1 text-[0.88rem] text-[var(--color-muted-foreground)]">
                    Weather-based system alerts are estimated and do not replace official advisories.
                  </p>
                </div>

                {weather.alerts.length === 0 ? (
                  <div className="mt-5 rounded-[16px] border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-4 text-[0.9rem] text-[var(--color-muted-foreground)]">
                    No major weather-based flood alerts right now.
                  </div>
                ) : (
                  <div className="mt-5 space-y-3">
                    {weather.alerts.map((alert) => (
                      <AlertCard key={alert.id} alert={alert} />
                    ))}
                  </div>
                )}
              </div>

              <aside className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-5 shadow-[var(--shadow-soft)]">
                <h2 className="text-[1.2rem] font-semibold tracking-[-0.03em] text-[var(--color-foreground)]">
                  Monitoring Notes
                </h2>

                <div className="mt-4 space-y-2.5 text-[0.84rem] leading-6 text-[var(--color-muted-foreground)]">
                  <div className="rounded-[14px] bg-[var(--color-panel)] px-4 py-2.5">
                    <div className="flex items-center gap-2 text-[var(--color-foreground)]">
                      <MapPin className="h-4 w-4 text-[var(--color-primary)]" />
                      <span className="font-semibold">Monitored locations</span>
                    </div>
                    <p className="mt-2">
                      Metro Manila, Marikina, Quezon City, Manila, Pasig, Cainta, and Bulacan.
                    </p>
                  </div>

                  <div className="rounded-[14px] bg-[var(--color-panel)] px-4 py-2.5">
                    <div className="flex items-center gap-2 text-[var(--color-foreground)]">
                      <TriangleAlert className="h-4 w-4 text-[var(--color-primary)]" />
                      <span className="font-semibold">Risk explanation</span>
                    </div>
                    <p className="mt-2">{weather.advisoryMessage}</p>
                  </div>
                </div>
              </aside>
            </section>

            <section>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-[1.5rem] font-semibold tracking-[-0.03em] text-[var(--color-foreground)]">
                    Monitored Philippine Locations
                  </h2>
                  <p className="mt-1 text-[0.88rem] text-[var(--color-muted-foreground)]">
                    Default monitored areas remain visible for quick weather-based flood risk monitoring.
                  </p>
                </div>
                <div className="text-[0.76rem] text-[var(--color-muted-foreground)]">
                  Updated {weather.fetchedAt}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {weather.locations.map((location) => (
                  <MonitoredLocationCard key={location.name} location={location} />
                ))}
              </div>
            </section>
          </>
        )}

        <div className="h-20 md:hidden" />
      </div>
    </div>
  );
}
