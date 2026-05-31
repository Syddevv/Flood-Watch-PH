"use client";

import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Clock3,
  LayoutGrid,
  List,
  MapPin,
  Search,
} from "lucide-react";

import { EVACUATION_DIRECTORY_CENTERS } from "@/lib/constants";
import type { AlertSeverity, EvacuationDirectoryCenter } from "@/lib/types";
import { cn } from "@/lib/utils";

const riskOptions: Array<{ label: string; value: "all" | AlertSeverity }> = [
  { label: "All Risk Levels", value: "all" },
  { label: "Safe", value: "safe" },
  { label: "Moderate", value: "moderate" },
  { label: "High", value: "high" },
  { label: "Severe", value: "severe" },
];

const sortOptions = [
  { label: "By Distance", value: "distance" },
  { label: "By Travel Time", value: "travel" },
] as const;

const badgeClasses: Record<AlertSeverity, string> = {
  safe: "border-[rgba(34,197,94,0.34)] bg-[rgba(34,197,94,0.08)] text-[var(--color-success)]",
  moderate:
    "border-[rgba(245,158,11,0.34)] bg-[rgba(245,158,11,0.08)] text-[var(--color-warning)]",
  high: "border-[rgba(249,115,22,0.34)] bg-[rgba(249,115,22,0.08)] text-[var(--color-high)]",
  severe:
    "border-[rgba(239,68,68,0.34)] bg-[rgba(239,68,68,0.08)] text-[var(--color-danger)]",
};

const badgeLabels: Record<AlertSeverity, string> = {
  safe: "Safe",
  moderate: "Moderate Risk",
  high: "High Risk",
  severe: "Severe Flooding",
};

function SelectMenu<T extends string>({
  label,
  value,
  options,
  open,
  onOpenChange,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ label: string; value: T }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (value: T) => void;
  className?: string;
}) {
  const selected = options.find((option) => option.value === value);

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        aria-label={label}
        onClick={() => onOpenChange(!open)}
        className="flex h-10 min-w-[140px] items-center justify-between rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-[0.92rem] text-[var(--color-foreground)] shadow-[var(--shadow-soft)]"
      >
        <span>{selected?.label}</span>
        <ChevronDown className="h-4 w-4 text-[var(--color-muted-foreground)]" />
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+0.4rem)] z-[1100] min-w-full overflow-hidden rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_18px_40px_rgba(15,23,42,0.14)]">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                onOpenChange(false);
              }}
              className={cn(
                "flex w-full items-center justify-between px-4 py-3 text-left text-[0.92rem]",
                option.value === value
                  ? "bg-[var(--color-panel)] text-[var(--color-primary)]"
                  : "text-[var(--color-foreground)] hover:bg-[var(--color-panel)]",
              )}
            >
              <span>{option.label}</span>
              {option.value === value ? <Check className="h-4 w-4" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CenterCard({
  center,
  view,
}: {
  center: EvacuationDirectoryCenter;
  view: "grid" | "list";
}) {
  if (view === "list") {
    return (
      <article className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3.5 shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-[0.98rem] font-semibold tracking-[-0.02em] text-[var(--color-foreground)]">
                {center.name}
              </h2>
              <span
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-[0.7rem] font-semibold",
                  badgeClasses[center.risk],
                )}
              >
                {badgeLabels[center.risk]}
              </span>
            </div>

            <div className="mt-1 text-[0.88rem] text-[var(--color-muted-foreground)]">
              {center.address}
            </div>

            <p className="mt-2 text-[0.86rem] leading-6 text-[var(--color-muted-foreground)]">
              {center.description}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-5 self-stretch">
            <div className="flex min-w-[72px] flex-col items-end justify-center text-right">
              <div className="flex items-center gap-1.5 text-[0.9rem] font-semibold text-[var(--color-foreground)]">
                <ArrowUpRight className="h-3.5 w-3.5 text-[var(--color-muted-foreground)]" />
                <span>{center.distanceKm.toFixed(1)} km</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[0.8rem] text-[var(--color-muted-foreground)]">
                <Clock3 className="h-3.25 w-3.25" />
                <span>{center.travelMinutesCar} min</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="h-9 rounded-[11px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-[0.86rem] font-medium text-[var(--color-foreground)]"
              >
                Map
              </button>
              <button
                type="button"
                className="h-9 rounded-[11px] bg-[var(--color-primary)] px-4 text-[0.86rem] font-semibold text-white"
              >
                Directions
              </button>
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[1rem] font-semibold tracking-[-0.02em] text-[var(--color-foreground)]">
            {center.name}
          </h2>
          <div className="mt-0.5 text-[0.9rem] text-[var(--color-muted-foreground)]">
            {center.city}
          </div>
        </div>
        <span
          className={cn(
            "rounded-full border px-3 py-1 text-[0.72rem] font-semibold",
            badgeClasses[center.risk],
          )}
        >
          {badgeLabels[center.risk]}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2 text-[0.86rem] text-[var(--color-muted-foreground)]">
        <MapPin className="h-3.5 w-3.5 shrink-0" />
        <span>{center.address}</span>
      </div>

      <div className="mt-3 rounded-[14px] bg-[var(--color-panel)] px-4 py-2.5">
        <div className="flex items-center gap-2 text-[0.92rem] font-semibold text-[var(--color-foreground)]">
          <ArrowUpRight className="h-3.5 w-3.5 text-[var(--color-muted-foreground)]" />
          <span>{center.distanceKm.toFixed(1)} km away</span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-[0.84rem] text-[var(--color-muted-foreground)]">
          <Clock3 className="h-3.5 w-3.5" />
          <span>
            {center.travelMinutesCar} min by car · {center.travelMinutesWalk} min walking
          </span>
        </div>
      </div>

      <p className="mt-3 text-[0.88rem] leading-6.5 text-[var(--color-foreground)]">
        {center.description}
      </p>
      <div className="mt-1 text-[0.84rem] text-[var(--color-muted-foreground)]">
        Risk source: {center.source}
      </div>

      <div className="mt-3.5 grid grid-cols-2 gap-2.5">
        <button
          type="button"
          className="h-10 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-[0.9rem] font-medium text-[var(--color-foreground)]"
        >
          View on Map
        </button>
        <button
          type="button"
          className="h-10 rounded-[12px] bg-[var(--color-primary)] text-[0.9rem] font-semibold text-white"
        >
          Get Directions
        </button>
      </div>
    </article>
  );
}

export function EvacuationCentersContent() {
  const [query, setQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<"all" | AlertSeverity>("all");
  const [sortBy, setSortBy] = useState<"distance" | "travel">("distance");
  const [riskMenuOpen, setRiskMenuOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");

  const filteredCenters = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return EVACUATION_DIRECTORY_CENTERS.filter((center) => {
      const matchesRisk = riskFilter === "all" ? true : center.risk === riskFilter;
      const matchesQuery = normalized
        ? [center.name, center.city, center.address].some((field) =>
            field.toLowerCase().includes(normalized),
          )
        : true;

      return matchesRisk && matchesQuery;
    }).sort((left, right) =>
      sortBy === "distance"
        ? left.distanceKm - right.distanceKm
        : left.travelMinutesCar - right.travelMinutesCar,
    );
  }, [query, riskFilter, sortBy]);

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-[var(--color-background)] [scrollbar-gutter:stable]">
      <div className="mx-auto flex min-h-full w-full max-w-[1460px] flex-col gap-5 px-4 py-5 md:px-6 md:py-6 xl:px-8">
        <section>
          <h1 className="text-[2rem] font-semibold tracking-[-0.03em] text-[var(--color-foreground)]">
            Evacuation Centers
          </h1>
          <p className="mt-1.5 text-[0.95rem] text-[var(--color-muted-foreground)]">
           Find nearby evacuation centers, view flood risk conditions, and get directions during emergencies.
          </p>
        </section>

        <div className="border-t border-[var(--color-border)]" />

        <section className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="flex h-10 flex-1 items-center gap-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 shadow-[var(--shadow-soft)]">
            <Search className="h-4 w-4 text-[var(--color-muted-foreground)]" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name or location..."
              className="w-full bg-transparent text-[0.92rem] text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted-foreground)]"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2.5">
            <SelectMenu
              label="Risk level filter"
              value={riskFilter}
              options={riskOptions}
              open={riskMenuOpen}
              onOpenChange={(open) => {
                setRiskMenuOpen(open);
                if (open) {
                  setSortMenuOpen(false);
                }
              }}
              onChange={setRiskFilter}
            />

            <SelectMenu
              label="Sort centers"
              value={sortBy}
              options={sortOptions}
              open={sortMenuOpen}
              onOpenChange={(open) => {
                setSortMenuOpen(open);
                if (open) {
                  setRiskMenuOpen(false);
                }
              }}
              onChange={setSortBy}
            />

            <div className="flex h-10 items-center rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-[var(--shadow-soft)]">
              <button
                type="button"
                aria-label="Grid view"
                onClick={() => setView("grid")}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-[10px]",
                  view === "grid"
                    ? "bg-[var(--color-panel)] text-[var(--color-foreground)]"
                    : "text-[var(--color-muted-foreground)]",
                )}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="List view"
                onClick={() => setView("list")}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-[10px]",
                  view === "list"
                    ? "bg-[var(--color-panel)] text-[var(--color-foreground)]"
                    : "text-[var(--color-muted-foreground)]",
                )}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>

        <section
          className={cn(
            "grid gap-4",
            view === "grid"
              ? "grid-cols-1 md:grid-cols-2 2xl:grid-cols-3"
              : "grid-cols-1",
          )}
        >
          {filteredCenters.map((center) => (
            <CenterCard key={center.id} center={center} view={view} />
          ))}
        </section>

        <div className="h-20 md:hidden" />
      </div>
    </div>
  );
}
