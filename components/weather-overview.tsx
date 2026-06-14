import { CloudDrizzle, Droplets, Wind } from "lucide-react";

import { severityBadgeClasses } from "@/lib/report-ui";
import type { AlertSeverity, FloodRiskLevel, WeatherOverviewData } from "@/lib/types";
import { cn } from "@/lib/utils";

function formatTemperature(temperature: number | null) {
  return temperature === null ? "--" : `${temperature.toFixed(1)}°C`;
}

function formatPrecipitation(precipitation: number | null) {
  return precipitation === null ? "Precipitation unavailable" : `${precipitation.toFixed(1)} mm/hr`;
}

function formatHumidity(humidity: number | null) {
  return humidity === null ? null : `${humidity.toFixed(0)}% humidity`;
}

function formatWindSpeed(windSpeed: number | null) {
  return windSpeed === null ? null : `${windSpeed.toFixed(1)} km/h wind`;
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

export function WeatherOverview({ weather }: { weather: WeatherOverviewData }) {
  return (
    <section className="grid grid-cols-1 gap-3">
      {weather.locations.map((location) => (
        <article
          key={location.name}
          className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3.5 shadow-[var(--shadow-soft)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-[0.9rem] font-semibold text-[var(--color-foreground)]">
                {location.name}
              </div>
              <p className="mt-1 text-[0.8rem] text-[var(--color-muted-foreground)]">
                {location.condition ?? "Weather conditions unavailable"}
              </p>
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

          <div className="mt-3 flex items-end justify-between gap-3">
            <div className="font-mono text-[1.5rem] font-semibold leading-none text-[var(--color-foreground)]">
              {formatTemperature(location.temperature)}
            </div>
            <div className="flex items-center gap-1.5 text-[0.76rem] text-[var(--color-muted-foreground)]">
              <CloudDrizzle className="h-3.5 w-3.5 text-[var(--color-primary)]" />
              <span>{formatPrecipitation(location.precipitation)}</span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-[0.72rem] text-[var(--color-muted-foreground)]">
            {formatHumidity(location.humidity) ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-panel)] px-2 py-1">
                <Droplets className="h-3 w-3" />
                <span>{formatHumidity(location.humidity)}</span>
              </span>
            ) : null}
            {formatWindSpeed(location.windSpeed) ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-panel)] px-2 py-1">
                <Wind className="h-3 w-3" />
                <span>{formatWindSpeed(location.windSpeed)}</span>
              </span>
            ) : null}
          </div>

          <div className="mt-3 text-[0.72rem] text-[var(--color-muted-foreground)]">
            Updated {location.updatedAt}
          </div>
          <div className="mt-1 text-[0.7rem] text-[var(--color-muted-foreground)]">
            {location.source}
          </div>
        </article>
      ))}
    </section>
  );
}
