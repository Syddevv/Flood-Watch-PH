"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, SquareStack } from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { AboutContent } from "@/components/about-content";
import { EmergencyHotlinesContent } from "@/components/emergency-hotlines-content";
import { FloodMap } from "@/components/flood-map";
import { IncidentReportModal } from "@/components/incident-report-modal";
import { EvacuationCentersContent } from "@/components/evacuation-centers-content";
import { IncidentReportsContent } from "@/components/incident-reports-content";
import { MobileLiveInfoSheet } from "@/components/mobile-live-info-sheet";
import { RightInfoPanel } from "@/components/right-info-panel";
import { Sidebar } from "@/components/sidebar";
import { WeatherMonitoringContent } from "@/components/weather-monitoring-content";
import {
  EMERGENCY_HOTLINES,
  EVACUATION_CENTERS,
  FLOOD_LEGEND,
  FLOOD_POLYGONS,
  HOTLINE_NOTICE,
  LIVE_TIMESTAMP,
  NAV_ITEMS,
  REPORT_MARKER_LEGEND,
  REPORT_LABEL,
  THEME_STORAGE_KEY,
} from "@/lib/constants";
import type { ReportDetailResponse, ReportRecord, ReportsResponse } from "@/lib/report-types";
import {
  buildStoredActionKey,
  mapReportToIncident,
} from "@/lib/report-ui";
import type { IncidentReport, ReportMapMarker, Theme, WeatherOverviewData } from "@/lib/types";
import { cn } from "@/lib/utils";
import { fetchWeatherOverview } from "@/lib/weather-client";
import { createReportActionHeaders } from "@/lib/report-session";
import { getSidebarWeatherOverview } from "@/lib/weather";
import {
  hasValidCoordinates,
  matchesFilter,
  reportFilterOptions,
  type ReportFilterId,
} from "@/components/flood-map";

type DashboardShellProps = {
  pageMode?:
    | "flood-map"
    | "weather-monitoring"
    | "evacuation-centers"
    | "incident-reports"
      | "emergency-hotlines"
      | "about";
};

const EMPTY_WEATHER_OVERVIEW: WeatherOverviewData = {
  locations: [],
  alerts: [],
  fetchedAt: "",
};

function getActiveItemFromPageMode(
  pageMode: NonNullable<DashboardShellProps["pageMode"]>,
) {
  return pageMode === "flood-map"
    ? "flood-map"
    : pageMode === "weather-monitoring"
      ? "weather-monitoring"
      : pageMode === "evacuation-centers"
        ? "evacuation-centers"
        : pageMode === "incident-reports"
          ? "incident-reports"
          : pageMode === "emergency-hotlines"
            ? "emergency-hotlines"
            : pageMode === "about"
              ? "about"
              : "flood-map";
}

export function DashboardShell({
  pageMode = "flood-map",
}: DashboardShellProps) {
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>("light");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const activeItem = getActiveItemFromPageMode(pageMode);
  const isFloodMapView = pageMode === "flood-map";
  const isWeatherMonitoringView = pageMode === "weather-monitoring";
  const isEvacuationCentersView = pageMode === "evacuation-centers";
  const isIncidentReportsView = pageMode === "incident-reports";
  const isEmergencyHotlinesView = pageMode === "emergency-hotlines";
  const isAboutView = pageMode === "about";
  const isContentOnlyView =
    isWeatherMonitoringView ||
    isEvacuationCentersView ||
    isIncidentReportsView ||
    isEmergencyHotlinesView ||
    isAboutView;
  const [floodMapReports, setFloodMapReports] = useState<IncidentReport[]>([]);
  const [floodMapUpdatesByReportId, setFloodMapUpdatesByReportId] = useState<Record<string, ReportDetailResponse["data"]["updates"]>>({});
  const [floodMapLoadingReports, setFloodMapLoadingReports] = useState(false);
  const [floodMapReportLoadError, setFloodMapReportLoadError] = useState<string | null>(null);
  const [floodMapSelectedFilter, setFloodMapSelectedFilter] = useState<ReportFilterId>(
    reportFilterOptions[0].id,
  );
  const [floodMapShowRiskOverlays, setFloodMapShowRiskOverlays] = useState(false);
  const [floodMapPreviewReportId, setFloodMapPreviewReportId] = useState<string | null>(null);
  const [floodMapSelectedReportId, setFloodMapSelectedReportId] = useState<string | null>(null);
  const [floodMapModalOpen, setFloodMapModalOpen] = useState(false);
  const [floodMapActionLoadingId, setFloodMapActionLoadingId] = useState<string | null>(null);
  const [floodMapConfirmedReportIds, setFloodMapConfirmedReportIds] = useState<Record<string, boolean>>({});
  const [floodMapResolvedReportIds, setFloodMapResolvedReportIds] = useState<Record<string, boolean>>({});
  const [weatherOverview, setWeatherOverview] = useState<WeatherOverviewData>(EMPTY_WEATHER_OVERVIEW);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  useEffect(() => {
    let frameId = 0;

    try {
      const rootTheme = document.documentElement.dataset.theme;
      const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      const nextTheme: Theme =
        storedTheme === "dark" || rootTheme === "dark" ? "dark" : "light";

      frameId = window.requestAnimationFrame(() => {
        setTheme(nextTheme);
      });
    } catch {
      frameId = window.requestAnimationFrame(() => {
        setTheme("light");
      });
    }

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    if (isContentOnlyView && !isWeatherMonitoringView) {
      return;
    }

    let isMounted = true;
    const abortController = new AbortController();

    async function loadWeatherOverview() {
      setWeatherLoading(true);
      setWeatherError(null);

      try {
        const nextWeatherOverview = await fetchWeatherOverview(abortController.signal);

        if (!isMounted) {
          return;
        }

        setWeatherOverview(nextWeatherOverview);
      } catch (error) {
        if (!isMounted || abortController.signal.aborted) {
          return;
        }

        console.error("Failed to load weather overview.", error);
        setWeatherError("Unable to load weather data.");
      } finally {
        if (isMounted) {
          setWeatherLoading(false);
        }
      }
    }

    loadWeatherOverview();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [isContentOnlyView, isWeatherMonitoringView]);

  useEffect(() => {
    if (!isFloodMapView) {
      return;
    }

    let isMounted = true;

    async function loadFloodMapReports() {
      setFloodMapLoadingReports(true);
      setFloodMapReportLoadError(null);

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
        setFloodMapReports(nextReports);

        if (typeof window !== "undefined") {
          const nextConfirmed: Record<string, boolean> = {};
          const nextResolved: Record<string, boolean> = {};

          for (const report of nextReports) {
            nextConfirmed[report.id] =
              localStorage.getItem(buildStoredActionKey("confirmed", report.id)) === "true";
            nextResolved[report.id] =
              localStorage.getItem(buildStoredActionKey("resolved", report.id)) === "true";
          }

          setFloodMapConfirmedReportIds(nextConfirmed);
          setFloodMapResolvedReportIds(nextResolved);
        }
      } catch (error) {
        console.error("Failed to load flood map reports.", error);
        if (isMounted) {
          setFloodMapReportLoadError("Unable to load community reports.");
        }
      } finally {
        if (isMounted) {
          setFloodMapLoadingReports(false);
        }
      }
    }

    loadFloodMapReports();

    return () => {
      isMounted = false;
    };
  }, [isFloodMapView]);

  useEffect(() => {
    if (!isFloodMapView || !floodMapSelectedReportId || !floodMapModalOpen) {
      return;
    }

    const reportId = floodMapSelectedReportId;
    let isMounted = true;

    async function loadFloodMapReportDetails() {
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
        setFloodMapReports((current) =>
          current.map((report) => (report.id === nextReport.id ? nextReport : report)),
        );
        setFloodMapUpdatesByReportId((current) => ({
          ...current,
          [reportId]: payload.data.updates,
        }));
      } catch (error) {
        console.error("Failed to load report detail from flood map.", error);
      }
    }

    loadFloodMapReportDetails();

    return () => {
      isMounted = false;
    };
  }, [floodMapModalOpen, floodMapSelectedReportId, isFloodMapView]);

  const floodMapMappedReports = useMemo(
    () => floodMapReports.filter((report) => hasValidCoordinates(report)),
    [floodMapReports],
  );

  const floodMapFilteredReports = useMemo(
    () =>
      floodMapMappedReports.filter((report) =>
        matchesFilter(report, floodMapSelectedFilter),
      ),
    [floodMapMappedReports, floodMapSelectedFilter],
  );

  const floodMapReportMarkers = useMemo<ReportMapMarker[]>(
    () =>
      floodMapFilteredReports.map((report) => ({
        id: `report-marker-${report.id}`,
        label: "R",
        category: "report",
        severity: report.severity,
        coordinates: report.coordinates as [number, number],
        title: report.title,
        reportId: report.id,
        report,
      })),
    [floodMapFilteredReports],
  );

  const floodMapSidebarReports = useMemo(
    () => floodMapFilteredReports.slice(0, 5),
    [floodMapFilteredReports],
  );

  const floodMapPreviewReport = useMemo(
    () => floodMapReports.find((report) => report.id === floodMapPreviewReportId) ?? null,
    [floodMapReports, floodMapPreviewReportId],
  );

  const floodMapSelectedReport = useMemo(
    () => floodMapReports.find((report) => report.id === floodMapSelectedReportId) ?? null,
    [floodMapReports, floodMapSelectedReportId],
  );

  const sidebarWeatherOverview = useMemo(
    () => getSidebarWeatherOverview(weatherOverview),
    [weatherOverview],
  );

  const toggleTheme = () => {
    setTheme((currentTheme) => {
      const nextTheme: Theme = currentTheme === "light" ? "dark" : "light";
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
      return nextTheme;
    });
  };

  const handleSelect = (id: string) => {
    setSheetOpen(false);
    setSidebarOpen(false);

    if (id === "flood-map") {
      router.push("/");
      return;
    }

    if (id === "weather-monitoring") {
      router.push("/weather-monitoring");
      return;
    }

    if (id === "evacuation-centers") {
      router.push("/evacuation-centers");
      return;
    }

    if (id === "incident-reports") {
      router.push("/incident-reports");
      return;
    }

    if (id === "emergency-hotlines") {
      router.push("/emergency-hotlines");
      return;
    }

    if (id === "about") {
      router.push("/about");
      return;
    }
    setSheetOpen(false);
  };

  async function applyUpdatedFloodMapReport(
    reportId: string,
    payload: { data?: ReportRecord; error?: string },
    successStorageKey: "confirmed" | "resolved",
  ) {
    if (!payload.data) {
      throw new Error(payload.error ?? "Failed to update the report.");
    }

    if (typeof window !== "undefined") {
      localStorage.setItem(buildStoredActionKey(successStorageKey, reportId), "true");
    }

    if (successStorageKey === "confirmed") {
      setFloodMapConfirmedReportIds((current) => ({
        ...current,
        [reportId]: true,
      }));
    } else {
      setFloodMapResolvedReportIds((current) => ({
        ...current,
        [reportId]: true,
      }));
    }

    setFloodMapReports((current) =>
      current.map((report) =>
        report.id === reportId ? mapReportToIncident(payload.data as ReportRecord) : report,
      ),
    );
  }

  async function handleConfirmFloodMapReport(reportId: string) {
    if (floodMapConfirmedReportIds[reportId]) {
      return;
    }

    setFloodMapActionLoadingId(reportId);

    try {
      const response = await fetch(`/api/reports/${reportId}/confirm`, {
        method: "POST",
        headers: createReportActionHeaders(),
      });
      const payload = (await response.json()) as { data?: ReportRecord; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to confirm the report.");
      }

      await applyUpdatedFloodMapReport(reportId, payload, "confirmed");
    } catch (error) {
      console.error("Failed to confirm report from flood map.", error);
    } finally {
      setFloodMapActionLoadingId(null);
    }
  }

  async function handleResolveFloodMapReport(reportId: string) {
    if (floodMapResolvedReportIds[reportId]) {
      return;
    }

    setFloodMapActionLoadingId(reportId);

    try {
      const response = await fetch(`/api/reports/${reportId}/resolve`, {
        method: "POST",
        headers: createReportActionHeaders(),
      });
      const payload = (await response.json()) as { data?: ReportRecord; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to update the report.");
      }

      await applyUpdatedFloodMapReport(reportId, payload, "resolved");
    } catch (error) {
      console.error("Failed to resolve report from flood map.", error);
    } finally {
      setFloodMapActionLoadingId(null);
    }
  }

  return (
    <div className="h-screen overflow-hidden bg-[var(--color-background)] text-[var(--color-foreground)]">
      <AppHeader
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenSidebar={() => setSidebarOpen(true)}
      />

      <div
        className="pt-[var(--header-height)]"
      >
        <div
          className={cn(
            "grid h-[calc(100vh-var(--header-height))] min-h-0 bg-[var(--color-background)]",
            isContentOnlyView
              ? "md:grid-cols-[var(--sidebar-width)_minmax(0,1fr)]"
              : "md:grid-cols-[var(--sidebar-width)_minmax(0,1fr)_var(--panel-width)]",
          )}
        >
          <Sidebar
            items={NAV_ITEMS}
            activeItem={activeItem}
            onSelect={handleSelect}
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />

          <main
            className={cn(
              "relative h-full min-h-0 overflow-hidden md:col-start-2",
              isContentOnlyView && "md:col-end-4",
            )}
          >
            {isWeatherMonitoringView ? (
              <WeatherMonitoringContent
                weather={weatherOverview}
                weatherLoading={weatherLoading}
                weatherError={weatherError}
              />
            ) : isEvacuationCentersView ? (
              <EvacuationCentersContent />
            ) : isIncidentReportsView ? (
              <IncidentReportsContent />
            ) : isEmergencyHotlinesView ? (
              <EmergencyHotlinesContent />
            ) : isAboutView ? (
              <AboutContent />
            ) : (
              <div className="h-full min-h-0 w-full">
                <FloodMap
                  theme={theme}
                  polygons={FLOOD_POLYGONS}
                  legend={isFloodMapView ? REPORT_MARKER_LEGEND : FLOOD_LEGEND}
                  allowPolygonToggle={isFloodMapView}
                  showRiskOverlays={floodMapShowRiskOverlays}
                  onToggleRiskOverlays={() =>
                    setFloodMapShowRiskOverlays((current) => !current)
                  }
                  reportMarkers={floodMapReportMarkers}
                  selectedFilter={floodMapSelectedFilter}
                  onSelectFilter={setFloodMapSelectedFilter}
                  loadingReports={floodMapLoadingReports}
                  reportLoadError={floodMapReportLoadError}
                  previewReport={floodMapPreviewReport}
                  onSelectReport={setFloodMapPreviewReportId}
                  onClosePreview={() => setFloodMapPreviewReportId(null)}
                  onOpenReportDetails={(reportId) => {
                    setFloodMapSelectedReportId(reportId);
                    setFloodMapModalOpen(true);
                  }}
                />
              </div>
            )}

            <div className="pointer-events-none absolute inset-x-0 bottom-6 z-[500] flex items-end justify-between px-4 md:hidden">
              {!isContentOnlyView || isFloodMapView ? (
                <button
                  type="button"
                  onClick={() => setSheetOpen(true)}
                  className="pointer-events-auto flex h-12 items-center gap-2 rounded-full bg-[var(--color-primary)] px-5 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(37,99,235,0.38)]"
                >
                  <SquareStack className="h-4 w-4" />
                  <span>Live Info</span>
                </button>
              ) : (
                <div />
              )}

              <button
                type="button"
                className="pointer-events-auto flex h-12 items-center gap-2 rounded-full bg-[#ff695f] px-5 text-sm font-semibold text-slate-950 shadow-[0_18px_40px_rgba(255,105,95,0.32)]"
              >
                <Plus className="h-4 w-4" />
                <span>{REPORT_LABEL.replace("Incident", "").trim()}</span>
              </button>
            </div>
          </main>

          {!isContentOnlyView || isFloodMapView ? (
            <RightInfoPanel
              alerts={weatherOverview.alerts}
              weather={sidebarWeatherOverview}
              weatherLoading={weatherLoading}
              weatherError={weatherError}
              alertsLoading={weatherLoading}
              alertsError={weatherError}
              centers={EVACUATION_CENTERS}
              hotlines={EMERGENCY_HOTLINES}
              hotlineNotice={HOTLINE_NOTICE}
              timestamp={weatherOverview.fetchedAt || LIVE_TIMESTAMP}
              officialAlertsTitle={
                isFloodMapView
                  ? "Official / System Flood Alerts"
                  : "ACTIVE FLOOD ALERTS"
              }
              showCommunityReportsSection={isFloodMapView}
              communityReports={floodMapSidebarReports}
              communityReportsLoading={floodMapLoadingReports}
              communityReportsError={floodMapReportLoadError}
              onViewCommunityReport={(reportId) => {
                setFloodMapSelectedReportId(reportId);
                setFloodMapModalOpen(true);
              }}
              communityReportsDisclaimer="Community reports may be unverified."
              className="hidden md:flex"
            />
          ) : null}
        </div>
      </div>

      {!isContentOnlyView || isFloodMapView ? (
        <MobileLiveInfoSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          alerts={weatherOverview.alerts}
          weather={sidebarWeatherOverview}
          weatherLoading={weatherLoading}
          weatherError={weatherError}
          alertsLoading={weatherLoading}
          alertsError={weatherError}
          centers={EVACUATION_CENTERS}
          hotlines={EMERGENCY_HOTLINES}
          hotlineNotice={HOTLINE_NOTICE}
          timestamp={weatherOverview.fetchedAt || LIVE_TIMESTAMP}
          officialAlertsTitle={
            isFloodMapView
              ? "Official / System Flood Alerts"
              : "ACTIVE FLOOD ALERTS"
          }
          showCommunityReportsSection={isFloodMapView}
          communityReports={floodMapSidebarReports}
          communityReportsLoading={floodMapLoadingReports}
          communityReportsError={floodMapReportLoadError}
          onViewCommunityReport={(reportId) => {
            setFloodMapSelectedReportId(reportId);
            setFloodMapModalOpen(true);
            setSheetOpen(false);
          }}
          communityReportsDisclaimer="Community reports may be unverified."
        />
      ) : null}

      {isFloodMapView ? (
        <IncidentReportModal
          key={floodMapSelectedReportId ?? "empty"}
          report={floodMapSelectedReport}
          updates={
            floodMapSelectedReportId
              ? floodMapUpdatesByReportId[floodMapSelectedReportId] ?? []
              : []
          }
          open={floodMapModalOpen}
          actionLoading={floodMapActionLoadingId === floodMapSelectedReportId}
          hasConfirmed={
            floodMapSelectedReportId
              ? Boolean(floodMapConfirmedReportIds[floodMapSelectedReportId])
              : false
          }
          hasResolved={
            floodMapSelectedReportId
              ? Boolean(floodMapResolvedReportIds[floodMapSelectedReportId])
              : false
          }
          onConfirm={handleConfirmFloodMapReport}
          onResolve={handleResolveFloodMapReport}
          onOpenChange={(open) => {
            setFloodMapModalOpen(open);
            if (!open) {
              setFloodMapSelectedReportId(null);
            }
          }}
        />
      ) : null}
    </div>
  );
}
