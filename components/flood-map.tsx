"use client";

import dynamic from "next/dynamic";
import { Check, ChevronDown, ChevronUp, Clock3, ThumbsUp, X } from "lucide-react";
import { useState } from "react";

import { formatCountLabel } from "@/lib/reporting";
import {
  getStatusPresentation,
  severityBadgeClasses,
  severityLabels,
} from "@/lib/report-ui";
import type { IncidentReport, LegendItem, ReportMapMarker, RiskPolygon, Theme } from "@/lib/types";
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
  { id: "all", label: "All Reports" },
  { id: "confirmed", label: "Confirmed by Community" },
  { id: "possibly-resolved", label: "Possibly Resolved" },
  { id: "resolved", label: "Resolved" },
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
    return report.status !== "Resolved";
  }

  if (filter === "confirmed") {
    return report.status === "Confirmed by Community";
  }

  if (filter === "possibly-resolved") {
    return report.status === "Possibly Resolved";
  }

  if (filter === "resolved") {
    return report.status === "Resolved";
  }

  return report.severity === "high" || report.severity === "severe";
}

type FloodMapProps = {
  theme: Theme;
  polygons: RiskPolygon[];
  legend: LegendItem[];
  allowPolygonToggle?: boolean;
  showRiskOverlays: boolean;
  onToggleRiskOverlays: () => void;
  reportMarkers: ReportMapMarker[];
  selectedFilter: ReportFilterId;
  onSelectFilter: (filter: ReportFilterId) => void;
  loadingReports: boolean;
  reportLoadError: string | null;
  previewReport: IncidentReport | null;
  onSelectReport: (reportId: string) => void;
  onClosePreview: () => void;
  onOpenReportDetails: (reportId: string) => void;
};

export function FloodMap({
  theme,
  polygons,
  legend,
  allowPolygonToggle = false,
  showRiskOverlays,
  onToggleRiskOverlays,
  reportMarkers,
  selectedFilter,
  onSelectFilter,
  loadingReports,
  reportLoadError,
  previewReport,
  onSelectReport,
  onClosePreview,
  onOpenReportDetails,
}: FloodMapProps) {
  const [mobileReportsPanelOpen, setMobileReportsPanelOpen] = useState(false);

  return (
    <div className="relative h-full min-h-0 w-full">
      <DynamicFloodMap
        theme={theme}
        reportMarkers={reportMarkers}
        polygons={showRiskOverlays ? polygons : []}
        legend={legend}
        onSelectReport={onSelectReport}
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
            {reportFilterOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => onSelectFilter(option.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[0.76rem] font-medium",
                  selectedFilter === option.id
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)]",
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
            Community reports may contain unverified information. Always follow official advisories from PAGASA, NDRRMC, LGUs, and emergency response agencies.
          </p>
          <div className="mt-3 rounded-[12px] bg-[var(--color-panel)] px-3 py-2 text-[0.82rem] text-[var(--color-foreground)]">
            {loadingReports
              ? "Loading flood reports..."
              : reportLoadError
                ? reportLoadError
                : reportMarkers.length === 0
                  ? "No mapped reports available right now."
                  : `${reportMarkers.length} mapped report${reportMarkers.length === 1 ? "" : "s"} visible`}
          </div>
        </div>
      </div>

      {previewReport ? (
        <div className="pointer-events-auto absolute bottom-24 right-4 z-[470] w-[min(320px,calc(100%-2rem))] rounded-[18px] border border-[color:color-mix(in_srgb,var(--color-border)_58%,transparent)] bg-[color:color-mix(in_srgb,var(--color-sidebar)_92%,transparent)] p-3 shadow-[var(--shadow-floating)] backdrop-blur-md md:bottom-4">
          <button
            type="button"
            aria-label="Close report preview"
            onClick={onClosePreview}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-panel)] text-[var(--color-foreground)]"
          >
            <X className="h-4 w-4" />
          </button>

          {previewReport.photos[0]?.imageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={previewReport.photos[0].imageUrl ?? undefined}
              alt={previewReport.title}
              className="h-32 w-full rounded-[14px] object-cover"
            />
          ) : null}

          <div className={cn(previewReport.photos[0]?.imageUrl ? "mt-3" : "")}>
            <div className="pr-10 text-[1rem] font-semibold leading-6 text-[var(--color-foreground)]">
              {previewReport.title}
            </div>
            <div className="mt-1 text-[0.85rem] text-[var(--color-muted-foreground)]">
              {previewReport.location}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <span
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[0.72rem] font-semibold",
                  severityBadgeClasses[previewReport.severity],
                )}
              >
                {severityLabels[previewReport.severity]}
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.72rem] font-medium",
                  getStatusPresentation(previewReport.status).textClassName,
                  getStatusPresentation(previewReport.status).wrapperClassName,
                )}
              >
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    getStatusPresentation(previewReport.status).dotClassName,
                  )}
                />
                <span>{previewReport.status}</span>
              </span>
            </div>
            <div className="mt-2 text-[0.82rem] text-[var(--color-foreground)]">
              {previewReport.category}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[0.76rem] text-[var(--color-muted-foreground)]">
              <div className="rounded-[10px] bg-[var(--color-panel)] px-2.5 py-2">
                <div className="flex items-center gap-1.5">
                  <ThumbsUp className="h-3.5 w-3.5" />
                  <span>{formatCountLabel(previewReport.confirmations)}</span>
                </div>
              </div>
              <div className="rounded-[10px] bg-[var(--color-panel)] px-2.5 py-2">
                <div className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5" />
                  <span>{formatCountLabel(previewReport.resolvedConfirmations)}</span>
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-[0.76rem] text-[var(--color-muted-foreground)]">
              <Clock3 className="h-3.5 w-3.5" />
              <span>{previewReport.reportedAgo}</span>
            </div>
            <button
              type="button"
              onClick={() => onOpenReportDetails(previewReport.id)}
              className="mt-3 flex h-10 w-full items-center justify-center rounded-[11px] bg-[var(--color-primary)] text-[0.86rem] font-semibold text-white"
            >
              View Details
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
