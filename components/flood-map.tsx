"use client";

import dynamic from "next/dynamic";
import { Building2, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

import { isActiveLifecycleStatus } from "@/lib/report-lifecycle";
import type {
  EvacuationCenterMapMarker,
  IncidentReport,
  LegendItem,
  ReportMapMarker,
  RiskPolygon,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const DynamicFloodMap = dynamic(
  () => import("@/components/flood-map-client").then((mod) => mod.FloodMapClient),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-0 w-full items-center justify-center bg-[var(--color-map-shell)] text-sm text-[var(--color-muted-foreground)]">
        Loading map...
      </div>
    ),
  },
);

export const reportFilterOptions = [
  { id: "active", label: "Active Reports" },
  { id: "likely-receded", label: "Likely Receded" },
  { id: "resolved", label: "Resolved" },
  { id: "all", label: "All Reports" },
  { id: "critical-high", label: "Critical / High Severity" },
] as const;

export type ReportFilterId = (typeof reportFilterOptions)[number]["id"];

export function hasValidCoordinates(report: IncidentReport) {
  return (
    Array.isArray(report.coordinates) &&
    report.coordinates.length === 2 &&
    Number.isFinite(report.coordinates[0]) &&
    Number.isFinite(report.coordinates[1])
  );
}

export function matchesFilter(report: IncidentReport, filter: ReportFilterId) {
  if (filter === "all") {
    return true;
  }

  if (filter === "active") {
    return isActiveLifecycleStatus(report.status);
  }

  if (filter === "likely-receded") {
    return report.status === "Likely Receded";
  }

  if (filter === "resolved") {
    return report.status === "Resolved";
  }

  return report.severity === "high" || report.severity === "severe";
}

type FloodMapProps = {
  polygons: RiskPolygon[];
  legend: LegendItem[];
  allowPolygonToggle?: boolean;
  showRiskOverlays: boolean;
  onToggleRiskOverlays: () => void;
  reportMarkers: ReportMapMarker[];
  evacuationCenterMarkers: EvacuationCenterMapMarker[];
  showFloodReports: boolean;
  showEvacuationCenters: boolean;
  onToggleFloodReports: () => void;
  onToggleEvacuationCenters: () => void;
  focusedCenterId?: string | null;
  selectedFilter: ReportFilterId;
  onSelectFilter: (filter: ReportFilterId) => void;
  loadingReports: boolean;
  reportLoadError: string | null;
  onOpenReportDetails: (reportId: string) => void;
};

export function FloodMap({
  polygons,
  legend,
  allowPolygonToggle = false,
  showRiskOverlays,
  onToggleRiskOverlays,
  reportMarkers,
  evacuationCenterMarkers,
  showFloodReports,
  showEvacuationCenters,
  onToggleFloodReports,
  onToggleEvacuationCenters,
  focusedCenterId = null,
  selectedFilter,
  onSelectFilter,
  loadingReports,
  reportLoadError,
  onOpenReportDetails,
}: FloodMapProps) {
  const [mobileReportsPanelOpen, setMobileReportsPanelOpen] = useState(false);

  return (
    <div className="relative h-full min-h-0 w-full">
      <DynamicFloodMap
        reportMarkers={showFloodReports ? reportMarkers : []}
        evacuationCenterMarkers={
          showEvacuationCenters ? evacuationCenterMarkers : []
        }
        polygons={showRiskOverlays ? polygons : []}
        legend={legend}
        onOpenReportDetails={onOpenReportDetails}
        focusedCenterId={focusedCenterId}
      />

      <div className="pointer-events-auto absolute left-4 top-4 z-[470] max-w-[calc(100%-6rem)] rounded-[18px] border border-[color:color-mix(in_srgb,var(--color-border)_58%,transparent)] bg-[color:color-mix(in_srgb,var(--color-sidebar)_90%,transparent)] px-3 py-3 shadow-[var(--shadow-floating)] backdrop-blur-md md:max-w-[360px]">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[0.7rem] font-semibold tracking-[0.06em] text-[var(--color-muted-foreground)]">
            LIVE COMMUNITY REPORTS
          </div>
          <button
            type="button"
            aria-label={mobileReportsPanelOpen ? "Collapse community report filters" : "Expand community report filters"}
            aria-expanded={mobileReportsPanelOpen}
            onClick={() => setMobileReportsPanelOpen((current) => !current)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)] md:hidden"
          >
            {mobileReportsPanelOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>
        <div className={cn("hidden md:block", mobileReportsPanelOpen && "block")}>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onToggleFloodReports}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[0.76rem] font-medium",
                showFloodReports
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                  : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)]",
              )}
            >
              Flood Reports
            </button>
            <button
              type="button"
              onClick={onToggleEvacuationCenters}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[0.76rem] font-medium",
                showEvacuationCenters
                  ? "border-[var(--color-success)] bg-[rgba(34,197,94,0.14)] text-[var(--color-success)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)]",
              )}
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>Evacuation Centers</span>
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {reportFilterOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => onSelectFilter(option.id)}
                disabled={!showFloodReports}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[0.76rem] font-medium",
                  selectedFilter === option.id
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)]",
                  !showFloodReports && "cursor-not-allowed opacity-45",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          {allowPolygonToggle ? (
            <div className="mt-3">
              <button
                type="button"
                onClick={onToggleRiskOverlays}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[0.76rem] font-medium",
                  showRiskOverlays
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)]",
                )}
              >
                {showRiskOverlays ? "Hide Risk Overlays" : "Show Risk Overlays"}
              </button>
            </div>
          ) : null}
          <p className="mt-3 text-[0.78rem] leading-6 text-[var(--color-muted-foreground)]">
            Active reports show current community hazard signals. Use the Likely Receded or Resolved filters to review clearing reports separately.
          </p>
          <div className="mt-3 rounded-[12px] bg-[var(--color-panel)] px-3 py-2 text-[0.82rem] text-[var(--color-foreground)]">
            {loadingReports
              ? "Loading flood reports..."
              : reportLoadError
                ? reportLoadError
                : !showFloodReports && !showEvacuationCenters
                  ? "Map layers are hidden. Turn on a layer to view markers."
                  : `${showFloodReports ? `${reportMarkers.length} report${reportMarkers.length === 1 ? "" : "s"}` : "0 reports"} · ${showEvacuationCenters ? `${evacuationCenterMarkers.length} center${evacuationCenterMarkers.length === 1 ? "" : "s"}` : "0 centers"} visible`}
          </div>
        </div>
      </div>

    </div>
  );
}
