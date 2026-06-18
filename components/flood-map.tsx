"use client";

import dynamic from "next/dynamic";
import { Building2, ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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

export const reportStatusFilterOptions = [
  { id: "active", label: "Active" },
  { id: "likely-receded", label: "Likely Receded" },
  { id: "resolved", label: "Resolved" },
  { id: "all", label: "All" },
] as const;

export type ReportStatusFilterId = (typeof reportStatusFilterOptions)[number]["id"];

export function hasValidCoordinates(report: IncidentReport) {
  return (
    Array.isArray(report.coordinates) &&
    report.coordinates.length === 2 &&
    Number.isFinite(report.coordinates[0]) &&
    Number.isFinite(report.coordinates[1])
  );
}

export function matchesReportStatusFilter(
  report: IncidentReport,
  filter: ReportStatusFilterId,
) {
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

  return false;
}

export function matchesHighSeverityFilter(report: IncidentReport) {
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
  selectedReportStatus: ReportStatusFilterId;
  onSelectReportStatus: (filter: ReportStatusFilterId) => void;
  highSeverityOnly: boolean;
  onToggleHighSeverityOnly: () => void;
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
  selectedReportStatus,
  onSelectReportStatus,
  highSeverityOnly,
  onToggleHighSeverityOnly,
  loadingReports,
  reportLoadError,
  onOpenReportDetails,
}: FloodMapProps) {
  const [isLayerPanelCollapsed, setIsLayerPanelCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (window.innerWidth < 768) {
      setIsLayerPanelCollapsed(true);
    }
  }, []);

  const layerSummary = useMemo(() => {
    if (loadingReports) {
      return "Loading map layers...";
    }

    if (reportLoadError) {
      return reportLoadError;
    }

    const parts: string[] = [];

    if (showFloodReports) {
      parts.push(`${reportMarkers.length} report${reportMarkers.length === 1 ? "" : "s"} visible`);
    }

    if (showEvacuationCenters) {
      parts.push(
        `${evacuationCenterMarkers.length} center${evacuationCenterMarkers.length === 1 ? "" : "s"} visible`,
      );
    } else if (showFloodReports) {
      parts.push("centers hidden");
    }

    if (parts.length === 0) {
      return "Map layers are hidden. Turn on a layer to view markers.";
    }

    return parts.join(" · ");
  }, [
    evacuationCenterMarkers.length,
    loadingReports,
    reportLoadError,
    reportMarkers.length,
    showEvacuationCenters,
    showFloodReports,
  ]);

  const helperText = showFloodReports
    ? showEvacuationCenters
      ? "Showing community reports and evacuation centers."
      : "Showing community reports only."
    : showEvacuationCenters
      ? "Showing evacuation centers only."
      : "Choose which map layers to show.";

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

      <div className="pointer-events-auto absolute left-4 top-4 z-[470] max-w-[calc(100%-6rem)] rounded-[18px] border border-[color:color-mix(in_srgb,var(--color-border)_58%,transparent)] bg-[color:color-mix(in_srgb,var(--color-sidebar)_90%,transparent)] px-3 py-3 shadow-[var(--shadow-floating)] backdrop-blur-md md:max-w-[340px]">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[0.7rem] font-semibold tracking-[0.06em] text-[var(--color-muted-foreground)]">
            MAP LAYERS
          </div>
          <button
            type="button"
            aria-label={isLayerPanelCollapsed ? "Expand map layers panel" : "Collapse map layers panel"}
            aria-expanded={!isLayerPanelCollapsed}
            onClick={() => setIsLayerPanelCollapsed((current) => !current)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)]"
          >
            {isLayerPanelCollapsed ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </button>
        </div>
        <div className="mt-3 rounded-[12px] bg-[var(--color-panel)] px-3 py-2 text-[0.82rem] text-[var(--color-foreground)]">
          {layerSummary}
        </div>
        <div className={cn("mt-3 space-y-3", isLayerPanelCollapsed && "hidden")}>
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
              Reports
            </button>
            <button
              type="button"
              onClick={onToggleEvacuationCenters}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[0.76rem] font-medium",
                showEvacuationCenters
                  ? "border-[var(--color-success)] bg-[rgba(34,197,94,0.16)] text-[var(--color-success)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)]",
              )}
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>Evacuation Centers</span>
            </button>
          </div>
          <div className={cn("space-y-2", !showFloodReports && "opacity-45")}>
            <label className="block text-[0.7rem] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted-foreground)]">
              Status
            </label>
            <select
              value={selectedReportStatus}
              onChange={(event) =>
                onSelectReportStatus(event.target.value as ReportStatusFilterId)
              }
              disabled={!showFloodReports}
              className="w-full rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[0.84rem] text-[var(--color-foreground)] outline-none"
            >
              {reportStatusFilterOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onToggleHighSeverityOnly}
              disabled={!showFloodReports}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[0.76rem] font-medium",
                highSeverityOnly
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                  : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)]",
                !showFloodReports && "cursor-not-allowed opacity-45",
              )}
            >
              High severity only
            </button>
            {allowPolygonToggle ? (
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
                Risk overlays
              </button>
            ) : null}
          </div>
          <p className="text-[0.78rem] leading-5 text-[var(--color-muted-foreground)]">
            {helperText}
          </p>
        </div>
      </div>

    </div>
  );
}
