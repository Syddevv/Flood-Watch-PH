import { Clock3, MapPin } from "lucide-react";

import type { FloodAlert } from "@/lib/types";
import { cn } from "@/lib/utils";

const severityClasses = {
  severe:
    "border-[color:var(--severity-severe-border)] bg-[color:var(--severity-severe-bg)]",
  high: "border-[color:var(--severity-high-border)] bg-[color:var(--severity-high-bg)]",
  moderate:
    "border-[color:var(--severity-moderate-border)] bg-[color:var(--severity-moderate-bg)]",
  safe: "border-[color:var(--severity-safe-border)] bg-[color:var(--severity-safe-bg)]",
};

const badgeClasses = {
  severe: "bg-[var(--color-danger)] text-white",
  high: "bg-[var(--color-high)] text-white",
  moderate: "bg-[var(--color-warning)] text-white",
  safe: "bg-[var(--color-success)] text-white",
};

const dotClasses = {
  severe: "bg-[var(--color-danger)]",
  high: "bg-[var(--color-high)]",
  moderate: "bg-[var(--color-warning)]",
  safe: "bg-[var(--color-success)]",
};

export function AlertCard({ alert }: { alert: FloodAlert }) {
  return (
    <article
      className={cn(
        "rounded-[18px] border px-4 py-3.5 shadow-[var(--shadow-soft)]",
        severityClasses[alert.severity],
      )}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <span
            className={cn("mt-0.5 h-2 w-2 rounded-full", dotClasses[alert.severity])}
          />
          <h3 className="text-[0.96rem] font-semibold leading-6 tracking-[-0.02em] text-[var(--color-foreground)]">
            {alert.title}
          </h3>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[0.62rem] font-semibold leading-none",
            badgeClasses[alert.severity],
          )}
        >
          {alert.badge}
        </span>
      </div>

      <div className="mt-3.5 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 text-[0.82rem] text-[var(--color-muted-foreground)]">
        <div className="flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="font-semibold text-[0.92rem] text-[var(--color-foreground)]">
            {alert.location}
          </span>
        </div>
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <span>Water level</span>
          <span className="font-mono text-[0.98rem] font-semibold text-[var(--color-foreground)]">
            {alert.waterLevel}
          </span>
        </div>
      </div>

      <p className="mt-3 text-[0.82rem] leading-6.5 text-[var(--color-muted-foreground)]">
        {alert.description}
      </p>

      <div className="mt-3.5 flex items-center gap-1.5 text-[0.72rem] text-[var(--color-muted-foreground)]">
        <Clock3 className="h-3.25 w-3.25 shrink-0" />
        <span>Updated {alert.updatedAt}</span>
      </div>
    </article>
  );
}
