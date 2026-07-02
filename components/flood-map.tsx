"use client";

import dynamic from "next/dynamic";
import { Building2, ChevronDown, ChevronUp, Layers } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { isActiveLifecycleStatus } from "@/lib/report-lifecycle";
import type { ReportActionLoadingState } from "@/lib/report-actions";
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
  focusedReportId?: string | null;
  focusedAlertLocation?: {
    id: string;
    coordinates: [number, number];
    zoom?: number;
  } | null;
  selectedReportId?: string | null;
  selectedReportStatus: ReportStatusFilterId;
  onSelectReportStatus: (filter: ReportStatusFilterId) => void;
  highSeverityOnly: boolean;
  onToggleHighSeverityOnly: () => void;
  loadingReports: boolean;
  reportLoadError: string | null;
  selectionNotice?: string | null;
  actionLoading: ReportActionLoadingState;
  confirmedReportIds: Record<string, boolean>;
  resolvedReportIds: Record<string, boolean>;
  onSelectReport: (reportId: string) => void;
  onOpenReportDetails: (reportId: string) => void;
  onConfirmReport: (reportId: string) => void;
  onResolveReport: (reportId: string) => void;
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
  focusedReportId = null,
  focusedAlertLocation = null,
  selectedReportId = null,
  selectedReportStatus,
  onSelectReportStatus,
  highSeverityOnly,
  onToggleHighSeverityOnly,
  loadingReports,
  reportLoadError,
  selectionNotice = null,
  actionLoading,
  confirmedReportIds,
  resolvedReportIds,
  onSelectReport,
  onOpenReportDetails,
  onConfirmReport,
  onResolveReport,
}: FloodMapProps) {
  const [isLayerPanelCollapsed, setIsLayerPanelCollapsed] = useState(false);
  const [isMapKeyOpen, setIsMapKeyOpen] = useState(false);

  const collapseMobileMapControls = useCallback(() => {
    if (typeof window === "undefined" || window.innerWidth >= 768) {
      return;
    }

    setIsLayerPanelCollapsed(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      if (window.innerWidth < 768) {
        setIsLayerPanelCollapsed(true);
      }
    });

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    if (!selectedReportId || typeof window === "undefined") {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      if (window.innerWidth < 768) {
        setIsLayerPanelCollapsed(true);
      }
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [selectedReportId]);

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

  const markerLegendItems = [
    {
      id: "active-reports",
      label: "Active reports",
      markerClassName:
        "bg-[var(--color-primary)] text-white shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-primary)_14%,transparent)]",
      glyph: "R",
    },
    {
      id: "likely-receded-reports",
      label: "Likely receded reports",
      markerClassName:
        "bg-[var(--color-muted-foreground)] text-white shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-muted-foreground)_14%,transparent)] opacity-85",
      glyph: "R",
    },
    {
      id: "evacuation-centers",
      label: "Evacuation centers",
      markerClassName:
        "bg-[var(--color-success)] text-white shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-success)_14%,transparent)]",
      glyph: "E",
    },
  ] as const;

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
        onSelectReport={onSelectReport}
        onConfirmReport={onConfirmReport}
        onResolveReport={onResolveReport}
        actionLoading={actionLoading}
        confirmedReportIds={confirmedReportIds}
        resolvedReportIds={resolvedReportIds}
        focusedCenterId={focusedCenterId}
        focusedReportId={focusedReportId}
        focusedAlertLocation={focusedAlertLocation}
        selectedReportId={selectedReportId}
        onMapInteractionStart={collapseMobileMapControls}
      />

      <div className="pointer-events-auto absolute left-4 top-4 z-[var(--layer-map-overlay)] hidden max-w-[calc(100%-6rem)] rounded-[16px] border border-[color:color-mix(in_srgb,var(--color-border)_62%,transparent)] bg-[color:color-mix(in_srgb,var(--color-sidebar)_94%,transparent)] px-3 py-3 shadow-[var(--shadow-floating)] backdrop-blur-md md:block md:max-w-[344px]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[0.96rem] font-semibold text-[var(--color-foreground)]">
              Map controls
            </div>
            <p className="mt-0.5 text-[0.76rem] leading-5 text-[var(--color-muted-foreground)]">
              Toggle layers, narrow report markers, and read the map key in one place.
            </p>
          </div>
          <button
            type="button"
            aria-label={isLayerPanelCollapsed ? "Expand map layers panel" : "Collapse map layers panel"}
            aria-expanded={!isLayerPanelCollapsed}
            onClick={() => setIsLayerPanelCollapsed((current) => !current)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)]"
          >
            {isLayerPanelCollapsed ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </button>
        </div>
        <div className="mt-3 rounded-[12px] border border-[color:color-mix(in_srgb,var(--color-border)_70%,transparent)] bg-[color:color-mix(in_srgb,var(--color-panel)_72%,transparent)] px-3 py-2 text-[0.8rem] text-[var(--color-foreground)]">
          <div className="font-medium">{layerSummary}</div>
          <div className="mt-0.5 text-[0.74rem] text-[var(--color-muted-foreground)]">
            {helperText}
          </div>
        </div>
        <div className={cn("mt-3 space-y-3", isLayerPanelCollapsed && "hidden")}>
          <section className="space-y-2">
            <div className="text-[0.74rem] font-medium text-[var(--color-muted-foreground)]">
              Active layers
            </div>
            <p className="text-[0.72rem] leading-4 text-[var(--color-muted-foreground)]">
              Tap a layer to show or hide pins.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onToggleFloodReports}
                aria-pressed={showFloodReports}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.76rem] font-medium transition-colors",
                  showFloodReports
                    ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)]",
                )}
              >
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    showFloodReports ? "bg-[var(--color-primary)]" : "bg-[var(--color-muted-foreground)]/50",
                  )}
                />
                <span>Reports</span>
              </button>
              <button
                type="button"
                onClick={onToggleEvacuationCenters}
                aria-pressed={showEvacuationCenters}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.76rem] font-medium transition-colors",
                  showEvacuationCenters
                    ? "border-[var(--color-success-border)] bg-[var(--color-success-surface)] text-[var(--color-success-text)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)]",
                )}
              >
                <Building2 className="h-3.5 w-3.5" />
                <span>Evacuation centers</span>
              </button>
              {allowPolygonToggle ? (
                <button
                  type="button"
                  onClick={onToggleRiskOverlays}
                  aria-pressed={showRiskOverlays}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.76rem] font-medium transition-colors",
                    showRiskOverlays
                      ? "border-[var(--color-warning-border)] bg-[var(--color-warning-surface)] text-[var(--color-warning-text)]"
                      : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)]",
                  )}
                >
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      showRiskOverlays ? "bg-[var(--color-warning)]" : "bg-[var(--color-muted-foreground)]/50",
                    )}
                  />
                  <span>Risk overlay</span>
                </button>
              ) : null}
            </div>
          </section>
          <section
            className={cn(
              "space-y-2 border-t border-[color:color-mix(in_srgb,var(--color-border)_70%,transparent)] pt-3",
              !showFloodReports && "opacity-50",
            )}
          >
            <div className="text-[0.74rem] font-medium text-[var(--color-muted-foreground)]">
              Report filters
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <select
                value={selectedReportStatus}
                onChange={(event) =>
                  onSelectReportStatus(event.target.value as ReportStatusFilterId)
                }
                disabled={!showFloodReports}
                className="w-full rounded-[11px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[0.82rem] text-[var(--color-foreground)] outline-none"
              >
                {reportStatusFilterOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={onToggleHighSeverityOnly}
                disabled={!showFloodReports}
                className={cn(
                  "rounded-[11px] border px-3 py-2 text-[0.76rem] font-medium transition-colors sm:whitespace-nowrap",
                  highSeverityOnly
                    ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)]",
                  !showFloodReports && "cursor-not-allowed opacity-60",
                )}
              >
                High severity only
              </button>
            </div>
          </section>
          <section className="space-y-2 border-t border-[color:color-mix(in_srgb,var(--color-border)_70%,transparent)] pt-3">
            <div className="text-[0.74rem] font-medium text-[var(--color-muted-foreground)]">
              Map key
            </div>
            <div className="space-y-2">
              {markerLegendItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 text-[0.8rem] text-[var(--color-foreground)]"
                >
                  <span
                    className={cn(
                      "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.68rem] font-semibold leading-none",
                      item.markerClassName,
                    )}
                  >
                    {item.glyph}
                  </span>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {legend.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 text-[0.76rem] text-[var(--color-muted-foreground)]"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{
                      backgroundColor:
                        item.severity === "severe"
                          ? "var(--color-danger)"
                          : item.severity === "high"
                            ? "var(--color-high)"
                            : item.severity === "moderate"
                              ? "var(--color-warning)"
                              : "var(--color-success)",
                    }}
                  />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-3 bottom-24 z-[var(--layer-map-overlay)] md:hidden">
        {isLayerPanelCollapsed ? (
          <div className="flex justify-end">
            <button
              type="button"
              aria-label="Open map controls"
              aria-expanded="false"
              onClick={() => setIsLayerPanelCollapsed(false)}
              className="floodwatch-mobile-map-control pointer-events-auto inline-flex min-h-11 items-center gap-2 rounded-full border border-[color:color-mix(in_srgb,var(--color-border)_68%,transparent)] bg-[color:color-mix(in_srgb,var(--color-sidebar)_94%,transparent)] px-3.5 text-[0.82rem] font-semibold text-[var(--color-foreground)] shadow-[var(--shadow-floating)] backdrop-blur-md"
            >
              <Layers className="h-4 w-4 text-[var(--color-primary)]" />
              <span>Layers</span>
              <span className="rounded-full bg-[var(--color-primary-soft)] px-2 py-0.5 text-[0.68rem] text-[var(--color-primary)]">
                {(showFloodReports ? 1 : 0) +
                  (showEvacuationCenters ? 1 : 0) +
                  (showRiskOverlays ? 1 : 0)}
              </span>
            </button>
          </div>
        ) : (
          <div className="floodwatch-mobile-map-control pointer-events-auto max-h-[46dvh] overflow-y-auto rounded-t-[18px] border border-[color:color-mix(in_srgb,var(--color-border)_62%,transparent)] bg-[color:color-mix(in_srgb,var(--color-sidebar)_96%,transparent)] px-3 py-3 shadow-[var(--shadow-floating)] backdrop-blur-md">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[0.9rem] font-semibold text-[var(--color-foreground)]">
                  Map controls
                </div>
                <div className="mt-0.5 truncate text-[0.72rem] text-[var(--color-muted-foreground)]">
                  {layerSummary}
                </div>
              </div>
              <button
                type="button"
                aria-label="Collapse map controls"
                aria-expanded="true"
                onClick={() => setIsLayerPanelCollapsed(true)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)]"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>

            <section className="mt-3 space-y-2">
              <p className="text-[0.72rem] leading-4 text-[var(--color-muted-foreground)]">
                Tap a layer to show or hide pins.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onToggleFloodReports}
                  aria-pressed={showFloodReports}
                  className={cn(
                    "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[11px] border px-2.5 text-[0.76rem] font-semibold transition-colors",
                    showFloodReports
                      ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white shadow-[var(--shadow-primary)]"
                      : "border-[var(--color-border)] bg-transparent text-[var(--color-muted-foreground)]",
                  )}
                >
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      showFloodReports ? "bg-white" : "bg-[var(--color-muted-foreground)]/50",
                    )}
                  />
                  <span>Reports</span>
                </button>
                <button
                  type="button"
                  onClick={onToggleEvacuationCenters}
                  aria-pressed={showEvacuationCenters}
                  className={cn(
                    "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[11px] border px-2.5 text-[0.76rem] font-semibold transition-colors",
                    showEvacuationCenters
                      ? "border-[var(--color-success-border)] bg-[var(--color-success-surface)] text-[var(--color-success-text)]"
                      : "border-[var(--color-border)] bg-transparent text-[var(--color-muted-foreground)]",
                  )}
                >
                  <Building2 className="h-3.5 w-3.5" />
                  <span className="truncate">Evacuation</span>
                </button>
                {allowPolygonToggle ? (
                  <button
                    type="button"
                    onClick={onToggleRiskOverlays}
                    aria-pressed={showRiskOverlays}
                    className={cn(
                      "col-span-2 inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[11px] border px-2.5 text-[0.76rem] font-semibold transition-colors",
                      showRiskOverlays
                        ? "border-[var(--color-warning-border)] bg-[var(--color-warning-surface)] text-[var(--color-warning-text)]"
                        : "border-[var(--color-border)] bg-transparent text-[var(--color-muted-foreground)]",
                    )}
                  >
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        showRiskOverlays
                          ? "bg-[var(--color-warning)]"
                          : "bg-[var(--color-muted-foreground)]/50",
                      )}
                    />
                    <span>Risk overlay</span>
                  </button>
                ) : null}
              </div>
            </section>

            <section
              className={cn(
                "mt-3 grid gap-2 border-t border-[color:color-mix(in_srgb,var(--color-border)_66%,transparent)] pt-3",
                !showFloodReports && "opacity-50",
              )}
            >
              <label className="grid gap-1.5">
                <span className="text-[0.72rem] font-medium text-[var(--color-muted-foreground)]">
                  Status filter
                </span>
                <select
                  value={selectedReportStatus}
                  onChange={(event) =>
                    onSelectReportStatus(event.target.value as ReportStatusFilterId)
                  }
                  disabled={!showFloodReports}
                  className="h-10 w-full rounded-[11px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[0.82rem] text-[var(--color-foreground)] outline-none"
                >
                  {reportStatusFilterOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={onToggleHighSeverityOnly}
                disabled={!showFloodReports}
                aria-pressed={highSeverityOnly}
                className={cn(
                  "min-h-10 rounded-[11px] border px-3 text-[0.78rem] font-semibold transition-colors",
                  highSeverityOnly
                    ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)]",
                  !showFloodReports && "cursor-not-allowed opacity-60",
                )}
              >
                High severity only
              </button>
            </section>

            <section className="mt-3 border-t border-[color:color-mix(in_srgb,var(--color-border)_66%,transparent)] pt-2">
              <button
                type="button"
                aria-expanded={isMapKeyOpen}
                onClick={() => setIsMapKeyOpen((current) => !current)}
                className="flex w-full items-center justify-between gap-3 rounded-[10px] px-1 py-1.5 text-left text-[0.78rem] font-semibold text-[var(--color-foreground)]"
              >
                <span>Map key</span>
                {isMapKeyOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
              {isMapKeyOpen ? (
                <div className="mt-2 grid gap-2">
                  {markerLegendItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 text-[0.76rem] text-[var(--color-foreground)]"
                    >
                      <span
                        className={cn(
                          "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.68rem] font-semibold leading-none",
                          item.markerClassName,
                        )}
                      >
                        {item.glyph}
                      </span>
                      <span>{item.label}</span>
                    </div>
                  ))}
                  <div className="grid grid-cols-2 gap-1.5">
                    {legend.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 text-[0.72rem] text-[var(--color-muted-foreground)]"
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{
                            backgroundColor:
                              item.severity === "severe"
                                ? "var(--color-danger)"
                                : item.severity === "high"
                                  ? "var(--color-high)"
                                  : item.severity === "moderate"
                                    ? "var(--color-warning)"
                                    : "var(--color-success)",
                          }}
                        />
                        <span>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        )}
      </div>

      {selectionNotice ? (
        <div className="pointer-events-none absolute inset-x-4 bottom-24 z-[var(--layer-map-overlay)] flex justify-center md:bottom-6">
          <div className="pointer-events-auto max-w-[360px] rounded-[12px] border border-[var(--color-warning-border)] bg-[var(--color-warning-surface)] px-3 py-2 text-center text-[0.78rem] font-medium text-[var(--color-warning-text)] shadow-[var(--shadow-soft)]">
            {selectionNotice}
          </div>
        </div>
      ) : null}

    </div>
  );
}
