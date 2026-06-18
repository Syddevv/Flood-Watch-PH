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

function getRiskSummaryTone(riskLevel: FloodRiskLevel) {
  if (riskLevel === "Critical") {
    return "text-[var(--color-danger)]";
  }

  if (riskLevel === "High") {
    return "text-[var(--color-high)]";
  }

  if (riskLevel === "Moderate") {
    return "text-[var(--color-warning)]";
  }

  return "text-[var(--color-success)]";
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

export function WeatherOverview({ weather }: { weather: WeatherOverviewData }) {
  return (
    <section className="grid grid-cols-1 gap-2">
      {weather.locations.map((location) => (
        <article
          key={location.name}
          className="rounded-[10px] border border-[color:color-mix(in_srgb,var(--color-border)_74%,transparent)] bg-[color:color-mix(in_srgb,var(--color-surface)_92%,transparent)] px-3.5 py-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-[0.86rem] font-semibold text-[var(--color-foreground)]">
                {location.name}
              </div>
              <p className="mt-0.5 text-[0.74rem] text-[var(--color-muted-foreground)]">
                {location.condition ?? "Weather conditions unavailable"}
              </p>
            </div>
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[0.62rem] font-semibold",
                severityBadgeClasses[getSeverityTone(location.riskLevel)],
              )}
            >
              {location.riskLevel}
            </span>
          </div>

          <div className="mt-2.5 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div className="min-w-0">
              <div
                className={cn(
                  "text-[0.8rem] font-semibold",
                  getRiskSummaryTone(location.riskLevel),
                )}
              >
                {location.riskLevel} flood risk
              </div>
              <div className="mt-0.5 text-[0.68rem] text-[var(--color-muted-foreground)]">
                Updated <span className="font-mono tabular-nums">{location.updatedAt}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 whitespace-nowrap text-[0.74rem] text-[var(--color-muted-foreground)]">
              <CloudDrizzle className="h-3.5 w-3.5 text-[var(--color-primary)]" />
              <span className="font-mono tabular-nums">{formatPrecipitation(location.precipitation)}</span>
            </div>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.68rem] text-[var(--color-muted-foreground)]">
            <span className="font-mono tabular-nums text-[0.92rem] font-semibold leading-none text-[var(--color-foreground)]">
              {formatTemperature(location.temperature)}
            </span>
            {formatHumidity(location.humidity) ? (
              <span className="inline-flex items-center gap-1">
                <Droplets className="h-3 w-3" />
                <span>{formatHumidity(location.humidity)}</span>
              </span>
            ) : null}
            {formatWindSpeed(location.windSpeed) ? (
              <span className="inline-flex items-center gap-1">
                <Wind className="h-3 w-3" />
                <span>{formatWindSpeed(location.windSpeed)}</span>
              </span>
            ) : null}
          </div>

          <div className="mt-2 border-t border-[color:color-mix(in_srgb,var(--color-border)_68%,transparent)] pt-2 text-[0.68rem] text-[var(--color-muted-foreground)]">
            Source: {location.source.name}
          </div>
          <div className="mt-0.5 text-[0.68rem] text-[var(--color-muted-foreground)]">
            Official reference: {location.officialReference.name}
          </div>
        </article>
      ))}
    </section>
  );
}
