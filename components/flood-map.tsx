"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Check, Clock3, ThumbsUp, X } from "lucide-react";

import { IncidentReportModal } from "@/components/incident-report-modal";
import { formatCountLabel } from "@/lib/reporting";
import type { ReportDetailResponse, ReportRecord, ReportsResponse } from "@/lib/report-types";
import {
  buildStoredActionKey,
  getStatusPresentation,
  mapReportToIncident,
  severityBadgeClasses,
  severityLabels,
} from "@/lib/report-ui";
import type {
  IncidentReport,
  LegendItem,
  MapMarker,
  ReportMapMarker,
  RiskPolygon,
  Theme,
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

const reportFilterOptions = [
  { id: "active", label: "Active Reports" },
  { id: "all", label: "All Reports" },
  { id: "confirmed", label: "Confirmed by Community" },
  { id: "possibly-resolved", label: "Possibly Resolved" },
  { id: "resolved", label: "Resolved" },
  { id: "critical-high", label: "Critical / High Severity" },
] as const;

type ReportFilterId = (typeof reportFilterOptions)[number]["id"];

type FloodMapProps = {
  theme: Theme;
  markers: MapMarker[];
  polygons: RiskPolygon[];
  legend: LegendItem[];
};

function hasValidCoordinates(report: IncidentReport) {
  return (
    Array.isArray(report.coordinates) &&
    report.coordinates.length === 2 &&
    Number.isFinite(report.coordinates[0]) &&
    Number.isFinite(report.coordinates[1])
  );
}

function matchesFilter(report: IncidentReport, filter: ReportFilterId) {
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

export function FloodMap({
  theme,
  markers,
  polygons,
  legend,
}: FloodMapProps) {
  const [reports, setReports] = useState<IncidentReport[]>([]);
  const [updatesByReportId, setUpdatesByReportId] = useState<Record<string, ReportDetailResponse["data"]["updates"]>>({});
  const [loadingReports, setLoadingReports] = useState(true);
  const [reportLoadError, setReportLoadError] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<ReportFilterId>("active");
  const [previewReportId, setPreviewReportId] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [confirmedReportIds, setConfirmedReportIds] = useState<Record<string, boolean>>({});
  const [resolvedReportIds, setResolvedReportIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let isMounted = true;

    async function loadReports() {
      setLoadingReports(true);
      setReportLoadError(null);

      try {
        const response = await fetch("/api/reports?limit=50", {
          cache: "no-store",
        });
        const payload = (await response.json()) as ReportsResponse | { error: string };

        if (!response.ok || !("data" in payload)) {
          throw new Error(
            "error" in payload ? payload.error : "Unable to load report markers. Please try again.",
          );
        }

        if (!isMounted) {
          return;
        }

        const nextReports = payload.data.map(mapReportToIncident);
        setReports(nextReports);

        if (typeof window !== "undefined") {
          const nextConfirmed: Record<string, boolean> = {};
          const nextResolved: Record<string, boolean> = {};

          for (const report of nextReports) {
            nextConfirmed[report.id] =
              localStorage.getItem(buildStoredActionKey("confirmed", report.id)) === "true";
            nextResolved[report.id] =
              localStorage.getItem(buildStoredActionKey("resolved", report.id)) === "true";
          }

          setConfirmedReportIds(nextConfirmed);
          setResolvedReportIds(nextResolved);
        }
      } catch (error) {
        console.error("Failed to load flood map reports.", error);
        if (isMounted) {
          setReportLoadError("Unable to load report markers. Please try again.");
        }
      } finally {
        if (isMounted) {
          setLoadingReports(false);
        }
      }
    }

    loadReports();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedReportId || !modalOpen) {
      return;
    }

    const reportId = selectedReportId;
    let isMounted = true;

    async function loadReportDetails() {
      try {
        const response = await fetch(`/api/reports/${reportId}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as ReportDetailResponse | { error: string };

        if (!response.ok || !("data" in payload)) {
          throw new Error("error" in payload ? payload.error : "Failed to load report details.");
        }

        if (!isMounted) {
          return;
        }

        const nextReport = mapReportToIncident(payload.data);
        setReports((current) =>
          current.map((report) => (report.id === nextReport.id ? nextReport : report)),
        );
        setUpdatesByReportId((current) => ({
          ...current,
          [reportId]: payload.data.updates,
        }));
      } catch (error) {
        console.error("Failed to load report detail from flood map.", error);
      }
    }

    loadReportDetails();

    return () => {
      isMounted = false;
    };
  }, [modalOpen, selectedReportId]);

  const selectedReport = useMemo(
    () => reports.find((report) => report.id === selectedReportId) ?? null,
    [reports, selectedReportId],
  );
  const previewReport = useMemo(
    () => reports.find((report) => report.id === previewReportId) ?? null,
    [reports, previewReportId],
  );

  const mappedReports = useMemo(
    () => reports.filter((report) => hasValidCoordinates(report)),
    [reports],
  );

  const filteredReports = useMemo(
    () => mappedReports.filter((report) => matchesFilter(report, selectedFilter)),
    [mappedReports, selectedFilter],
  );

  const reportMarkers = useMemo<ReportMapMarker[]>(
    () =>
      filteredReports.map((report) => ({
        id: `report-marker-${report.id}`,
        label: "R",
        category: "report",
        severity: report.severity,
        coordinates: report.coordinates as [number, number],
        title: report.title,
        reportId: report.id,
        report,
      })),
    [filteredReports],
  );

  async function applyUpdatedReport(reportId: string, payload: { data?: ReportRecord; error?: string }, successStorageKey: "confirmed" | "resolved") {
    if (!payload.data) {
      throw new Error(payload.error ?? "Failed to update the report.");
    }

    if (typeof window !== "undefined") {
      localStorage.setItem(buildStoredActionKey(successStorageKey, reportId), "true");
    }

    if (successStorageKey === "confirmed") {
      setConfirmedReportIds((current) => ({
        ...current,
        [reportId]: true,
      }));
    } else {
      setResolvedReportIds((current) => ({
        ...current,
        [reportId]: true,
      }));
    }

    setReports((current) =>
      current.map((report) =>
        report.id === reportId ? mapReportToIncident(payload.data as ReportRecord) : report,
      ),
    );
  }

  async function handleConfirmReport(reportId: string) {
    if (confirmedReportIds[reportId]) {
      return;
    }

    setActionLoadingId(reportId);

    try {
      const response = await fetch(`/api/reports/${reportId}/confirm`, {
        method: "POST",
      });
      const payload = (await response.json()) as { data?: ReportRecord; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to confirm the report.");
      }

      await applyUpdatedReport(reportId, payload, "confirmed");
    } catch (error) {
      console.error("Failed to confirm report from flood map.", error);
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleResolveReport(reportId: string) {
    if (resolvedReportIds[reportId]) {
      return;
    }

    setActionLoadingId(reportId);

    try {
      const response = await fetch(`/api/reports/${reportId}/resolve`, {
        method: "POST",
      });
      const payload = (await response.json()) as { data?: ReportRecord; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to update the report.");
      }

      await applyUpdatedReport(reportId, payload, "resolved");
    } catch (error) {
      console.error("Failed to resolve report from flood map.", error);
    } finally {
      setActionLoadingId(null);
    }
  }

  return (
    <div className="relative h-full min-h-0 w-full">
      <DynamicFloodMap
        theme={theme}
        markers={markers}
        reportMarkers={reportMarkers}
        polygons={polygons}
        legend={legend}
        onSelectReport={setPreviewReportId}
      />

      <div className="pointer-events-auto absolute left-4 top-4 z-[470] max-w-[calc(100%-6rem)] rounded-[18px] border border-[color:color-mix(in_srgb,var(--color-border)_58%,transparent)] bg-[color:color-mix(in_srgb,var(--color-sidebar)_90%,transparent)] px-3 py-3 shadow-[var(--shadow-floating)] backdrop-blur-md md:max-w-[360px]">
        <div className="text-[0.7rem] font-semibold tracking-[0.06em] text-[var(--color-muted-foreground)]">
          LIVE COMMUNITY REPORTS
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {reportFilterOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setSelectedFilter(option.id)}
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

      {previewReport ? (
        <div className="pointer-events-auto absolute bottom-24 right-4 z-[470] w-[min(320px,calc(100%-2rem))] rounded-[18px] border border-[color:color-mix(in_srgb,var(--color-border)_58%,transparent)] bg-[color:color-mix(in_srgb,var(--color-sidebar)_92%,transparent)] p-3 shadow-[var(--shadow-floating)] backdrop-blur-md md:bottom-4">
          <button
            type="button"
            aria-label="Close report preview"
            onClick={() => setPreviewReportId(null)}
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
              onClick={() => {
                setSelectedReportId(previewReport.id);
                setModalOpen(true);
              }}
              className="mt-3 flex h-10 w-full items-center justify-center rounded-[11px] bg-[var(--color-primary)] text-[0.86rem] font-semibold text-white"
            >
              View Details
            </button>
          </div>
        </div>
      ) : null}

      <IncidentReportModal
        key={selectedReportId ?? "empty"}
        report={selectedReport}
        updates={selectedReportId ? updatesByReportId[selectedReportId] ?? [] : []}
        open={modalOpen}
        actionLoading={actionLoadingId === selectedReportId}
        hasConfirmed={selectedReportId ? Boolean(confirmedReportIds[selectedReportId]) : false}
        hasResolved={selectedReportId ? Boolean(resolvedReportIds[selectedReportId]) : false}
        onConfirm={handleConfirmReport}
        onResolve={handleResolveReport}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) {
            setSelectedReportId(null);
          }
        }}
      />
    </div>
  );
}
