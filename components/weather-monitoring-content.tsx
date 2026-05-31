import {
  Activity,
  CloudDrizzle,
  CloudRain,
  Eye,
  Gauge,
  Thermometer,
  Waves,
  Wind,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { RainfallDay, WeatherMetric } from "@/lib/types";

const metrics: WeatherMetric[] = [
  { id: "temperature", label: "Temperature", value: "27°C", icon: Thermometer, tone: "amber" },
  { id: "humidity", label: "Humidity", value: "92%", icon: Waves, tone: "blue" },
  { id: "wind", label: "Wind Speed", value: "38 km/h", icon: Wind, tone: "blue" },
  { id: "rain", label: "Rain Probability", value: "95%", icon: CloudRain, tone: "red" },
  { id: "pressure", label: "Pressure", value: "998 hPa", icon: Gauge, tone: "blue" },
  { id: "visibility", label: "Visibility", value: "4 km", icon: Eye, tone: "amber" },
  { id: "uv", label: "UV Index", value: "Low (2)", icon: Activity, tone: "green" },
  { id: "signal", label: "Storm Signal", value: "No. 3", icon: CloudDrizzle, tone: "red" },
];

const rainfall: RainfallDay[] = [
  { day: "Mon", amount: 45 },
  { day: "Tue", amount: 88 },
  { day: "Wed", amount: 132 },
  { day: "Thu", amount: 96 },
  { day: "Fri", amount: 54 },
  { day: "Sat", amount: 28 },
  { day: "Sun", amount: 12 },
];

const toneClasses = {
  blue: "bg-[rgba(59,130,246,0.10)] text-[var(--color-primary)]",
  amber: "bg-[rgba(245,158,11,0.12)] text-[var(--color-warning)]",
  green: "bg-[rgba(34,197,94,0.12)] text-[var(--color-success)]",
  red: "bg-[rgba(239,68,68,0.10)] text-[var(--color-danger)]",
};

export function WeatherMonitoringContent() {
  const maxRainfall = Math.max(...rainfall.map((day) => day.amount));

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-[var(--color-background)]">
      <div className="mx-auto flex min-h-full w-full max-w-[1180px] flex-col gap-4 px-4 py-5 md:px-6 md:py-6">
        <section>
          <h1 className="text-[2rem] font-semibold tracking-[-0.03em] text-[var(--color-foreground)]">
            Weather Monitoring
          </h1>
          <p className="mt-1.5 text-[0.95rem] text-[var(--color-muted-foreground)]">
            Live meteorological conditions and rainfall forecast for Metro Manila, sourced from PAGASA.
          </p>
        </section>

        <section className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-5 shadow-[var(--shadow-soft)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="text-[var(--color-primary)]">
                <CloudRain className="h-14 w-14" strokeWidth={1.9} />
              </div>
              <div>
                <div className="font-mono text-[2.7rem] font-semibold leading-none text-[var(--color-foreground)]">
                  27°C
                </div>
                <div className="mt-1 text-[1.08rem] text-[var(--color-muted-foreground)]">
                  Heavy Rain · Metro Manila
                </div>
              </div>
            </div>

            <div className="rounded-[18px] border border-[color:color-mix(in_srgb,var(--color-danger)_28%,transparent)] bg-[color:color-mix(in_srgb,var(--color-danger)_8%,var(--color-surface))] px-4 py-3">
              <div className="text-[0.74rem] font-semibold tracking-[0.06em] text-[var(--color-danger)]">
                ACTIVE WARNING
              </div>
              <div className="mt-1 text-[1rem] font-semibold text-[var(--color-foreground)]">
                Tropical Storm - Signal No. 3
              </div>
              <div className="mt-1 text-[0.84rem] text-[var(--color-muted-foreground)]">
                Expected landfall within 12 hours
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => {
            const Icon = metric.icon;

            return (
              <article
                key={metric.id}
                className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3.5 shadow-[var(--shadow-soft)]"
              >
                <div
                  className={cn(
                    "flex h-8.5 w-8.5 items-center justify-center rounded-[11px]",
                    toneClasses[metric.tone],
                  )}
                >
                  <Icon className="h-4 w-4" strokeWidth={2} />
                </div>
                <div className="mt-4 text-[1.1rem] font-semibold text-[var(--color-foreground)]">
                  {metric.value}
                </div>
                <div className="mt-0.5 text-[0.84rem] text-[var(--color-muted-foreground)]">
                  {metric.label}
                </div>
              </article>
            );
          })}
        </section>

        <section className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-5 shadow-[var(--shadow-soft)]">
          <div>
            <h2 className="text-[1.5rem] font-semibold tracking-[-0.03em] text-[var(--color-foreground)]">
              7-Day Rainfall Outlook
            </h2>
            <p className="mt-1 text-[0.88rem] text-[var(--color-muted-foreground)]">
              Projected accumulation (mm)
            </p>
          </div>

          <div className="mt-6 grid h-[180px] grid-cols-7 items-end gap-1.5 md:gap-2">
            {rainfall.map((day) => (
              <div key={day.day} className="flex h-full flex-col justify-end">
                <div className="mb-2 text-center text-[0.8rem] text-[var(--color-muted-foreground)]">
                  {day.amount}
                </div>
                <div
                  className="rounded-t-[8px] bg-[linear-gradient(180deg,#5e85ea,#4f77df)]"
                  style={{ height: `${Math.max((day.amount / maxRainfall) * 116, 12)}px` }}
                />
                <div className="mt-2 text-center text-[0.8rem] text-[var(--color-muted-foreground)]">
                  {day.day}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="h-20 md:hidden" />
      </div>
    </div>
  );
}
