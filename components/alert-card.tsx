import { Clock3, MapPin } from "lucide-react";

import type { FloodAlert } from "@/lib/types";
import { cn } from "@/lib/utils";

const severityClasses = {
  severe: "border-[color:var(--severity-severe-border)]",
  high: "border-[color:var(--severity-high-border)]",
  moderate: "border-[color:var(--severity-moderate-border)]",
  safe: "border-[color:var(--severity-safe-border)]",
};

const headerClasses = {
  severe: "bg-[color:var(--severity-severe-bg)]",
  high: "bg-[color:var(--severity-high-bg)]",
  moderate: "bg-[color:var(--severity-moderate-bg)]",
  safe: "bg-[color:var(--severity-safe-bg)]",
};

const titleClasses = {
  severe: "text-[var(--color-danger)]",
  high: "text-[var(--color-high)]",
  moderate: "text-[var(--color-warning)]",
  safe: "text-[var(--color-success)]",
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
        "overflow-hidden rounded-[18px] border bg-[var(--color-surface)] shadow-[var(--shadow-soft)]",
        severityClasses[alert.severity],
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-2.5 border-b border-[color:color-mix(in_srgb,var(--color-border)_65%,transparent)] px-4 py-2.5",
          headerClasses[alert.severity],
        )}
      >
        <div className="flex items-center gap-2">
          <span
            className={cn("mt-0.5 h-2 w-2 rounded-full", dotClasses[alert.severity])}
          />
          <h3
            className={cn(
              "text-[0.92rem] font-semibold leading-none tracking-[-0.02em]",
              titleClasses[alert.severity],
            )}
          >
            {alert.title}
          </h3>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[0.6rem] font-semibold leading-none",
            badgeClasses[alert.severity],
          )}
        >
          {alert.badge}
        </span>
      </div>

      <div className="px-4 py-3.5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 text-[0.8rem] text-[var(--color-muted-foreground)]">
          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="font-semibold text-[0.92rem] text-[var(--color-foreground)]">
              {alert.location}
            </span>
          </div>
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span>Water level</span>
            <span className="font-mono text-[0.95rem] font-semibold text-[var(--color-foreground)]">
              {alert.waterLevel}
            </span>
          </div>
        </div>

        <p className="mt-3 text-[0.8rem] leading-7 text-[var(--color-muted-foreground)]">
          {alert.description}
        </p>

        <div className="mt-3.5 flex items-center gap-1.5 text-[0.72rem] text-[var(--color-muted-foreground)]">
          <Clock3 className="h-3.25 w-3.25 shrink-0" />
          <span>Updated {alert.updatedAt}</span>
        </div>
      </div>
    </article>
  );
}
