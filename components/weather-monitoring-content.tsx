import { CloudRain, Droplets, MapPin, TriangleAlert, Wind } from "lucide-react";

import { AlertCard } from "@/components/alert-card";
import { severityBadgeClasses } from "@/lib/report-ui";
import type { AlertSeverity, FloodRiskLevel, WeatherOverviewData } from "@/lib/types";
import { cn } from "@/lib/utils";

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

function getHighestRiskLabel(weather: WeatherOverviewData): FloodRiskLevel {
  if (weather.locations.some((location) => location.riskLevel === "Critical Risk")) {
    return "Critical Risk";
  }

  if (weather.locations.some((location) => location.riskLevel === "High Risk")) {
    return "High Risk";
  }

  if (weather.locations.some((location) => location.riskLevel === "Moderate Risk")) {
    return "Moderate Risk";
  }

  return "Low Risk";
}

function getSeverityTone(riskLevel: FloodRiskLevel): AlertSeverity {
  if (riskLevel === "Critical Risk") {
    return "severe";
  }

  if (riskLevel === "High Risk") {
    return "high";
  }

  if (riskLevel === "Moderate Risk") {
    return "moderate";
  }

  return "safe";
}

function getOverviewText(riskLevel: FloodRiskLevel) {
  if (riskLevel === "Critical Risk") {
    return "Increased flood risk due to heavy rainfall across monitored locations.";
  }

  if (riskLevel === "High Risk") {
    return "Heavy rainfall may increase flood risk in some monitored areas.";
  }

  if (riskLevel === "Moderate Risk") {
    return "Rainfall-based flood risk is elevated in at least one monitored area.";
  }

  return "No major weather-based flood alerts right now.";
}

export function WeatherMonitoringContent({
  weather,
  weatherLoading,
  weatherError,
}: WeatherMonitoringContentProps) {
  const highestRisk = getHighestRiskLabel(weather);
  const highlightedLocation =
    weather.locations.find((location) => location.riskLevel === highestRisk) ?? weather.locations[0];

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-[var(--color-background)]">
      <div className="mx-auto flex min-h-full w-full max-w-[1180px] flex-col gap-4 px-4 py-5 md:px-6 md:py-6">
        <section>
          <h1 className="text-[2rem] font-semibold tracking-[-0.03em] text-[var(--color-foreground)]">
            Weather Monitoring
          </h1>
          <p className="mt-1.5 text-[0.95rem] text-[var(--color-muted-foreground)]">
            Live weather conditions and rainfall-based flood risk for monitored Philippine locations.
          </p>
        </section>

        {weatherLoading ? (
          <section className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-5 shadow-[var(--shadow-soft)] text-[0.95rem] text-[var(--color-muted-foreground)]">
            Loading weather data...
          </section>
        ) : weatherError ? (
          <section className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-5 shadow-[var(--shadow-soft)] text-[0.95rem] text-[var(--color-muted-foreground)]">
            Unable to load weather data.
          </section>
        ) : (
          <>
            <section className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-5 shadow-[var(--shadow-soft)]">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4">
                  <div className="rounded-[18px] bg-[var(--color-panel)] p-3 text-[var(--color-primary)]">
                    <CloudRain className="h-12 w-12" strokeWidth={1.9} />
                  </div>
                  <div>
                    <div className="font-mono text-[2.7rem] font-semibold leading-none text-[var(--color-foreground)]">
                      {highlightedLocation ? formatTemperature(highlightedLocation.temperature) : "--"}
                    </div>
                    <div className="mt-1 text-[1.08rem] text-[var(--color-muted-foreground)]">
                      {highlightedLocation
                        ? `${highlightedLocation.condition ?? "Weather conditions unavailable"} · ${highlightedLocation.name}`
                        : "Weather conditions unavailable"}
                    </div>
                  </div>
                </div>

                <div className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-3">
                  <div className="text-[0.74rem] font-semibold tracking-[0.06em] text-[var(--color-section-heading)]">
                    WEATHER-BASED SYSTEM STATUS
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[0.7rem] font-semibold",
                        severityBadgeClasses[getSeverityTone(highestRisk)],
                      )}
                    >
                      {highestRisk}
                    </span>
                  </div>
                  <div className="mt-2 text-[0.84rem] text-[var(--color-muted-foreground)]">
                    {getOverviewText(highestRisk)}
                  </div>
                  <div className="mt-2 text-[0.76rem] text-[var(--color-muted-foreground)]">
                    Updated {weather.fetchedAt}
                  </div>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {weather.locations.map((location) => (
                <article
                  key={location.name}
                  className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3.5 shadow-[var(--shadow-soft)]"
                >
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
                    <div className="flex items-center gap-2">
                      <CloudRain className="h-4 w-4 text-[var(--color-primary)]" />
                      <span>Precipitation: {formatPrecipitation(location.precipitation)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Droplets className="h-4 w-4 text-[var(--color-primary)]" />
                      <span>Humidity: {formatHumidity(location.humidity)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Wind className="h-4 w-4 text-[var(--color-primary)]" />
                      <span>Wind speed: {formatWindSpeed(location.windSpeed)}</span>
                    </div>
                  </div>

                  <div className="mt-3 text-[0.74rem] text-[var(--color-muted-foreground)]">
                    Last updated {location.updatedAt}
                  </div>
                  <div className="mt-1 text-[0.72rem] text-[var(--color-muted-foreground)]">
                    {location.source}
                  </div>
                </article>
              ))}
            </section>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)]">
              <div className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-5 shadow-[var(--shadow-soft)]">
                <div>
                  <h2 className="text-[1.5rem] font-semibold tracking-[-0.03em] text-[var(--color-foreground)]">
                    Official / System Flood Alerts
                  </h2>
                  <p className="mt-1 text-[0.88rem] text-[var(--color-muted-foreground)]">
                    Weather-based system alerts are derived from available rainfall data and do not
                    replace official advisories.
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

                <div className="mt-4 space-y-3 text-[0.86rem] leading-7 text-[var(--color-muted-foreground)]">
                  <div className="rounded-[16px] bg-[var(--color-panel)] px-4 py-3">
                    <div className="flex items-center gap-2 text-[var(--color-foreground)]">
                      <MapPin className="h-4 w-4 text-[var(--color-primary)]" />
                      <span className="font-semibold">Monitored locations</span>
                    </div>
                    <p className="mt-2">
                      Metro Manila, Marikina, Quezon City, Manila, Pasig, Cainta, and Bulacan.
                    </p>
                  </div>

                  <div className="rounded-[16px] bg-[var(--color-panel)] px-4 py-3">
                    <div className="flex items-center gap-2 text-[var(--color-foreground)]">
                      <TriangleAlert className="h-4 w-4 text-[var(--color-primary)]" />
                      <span className="font-semibold">Advisory disclaimer</span>
                    </div>
                    <p className="mt-2">
                      System alerts are based on available weather data and may not replace official
                      advisories. Always follow PAGASA, NDRRMC, LGU, and emergency response
                      announcements.
                    </p>
                  </div>
                </div>
              </aside>
            </section>
          </>
        )}

        <div className="h-20 md:hidden" />
      </div>
    </div>
  );
}
