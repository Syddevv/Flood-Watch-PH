"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, SquareStack, X } from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { AboutContent } from "@/components/about-content";
import { EmergencyHotlinesContent } from "@/components/emergency-hotlines-content";
import { FloodMap } from "@/components/flood-map";
import { IncidentReportModal } from "@/components/incident-report-modal";
import { EvacuationCentersContent } from "@/components/evacuation-centers-content";
import { IncidentReportsContent } from "@/components/incident-reports-content";
import { LiveAlertsPanel } from "@/components/live-alerts-panel";
import { MobileLiveInfoSheet } from "@/components/mobile-live-info-sheet";
import { RightInfoPanel } from "@/components/right-info-panel";
import { Sidebar } from "@/components/sidebar";
import { WeatherMonitoringContent } from "@/components/weather-monitoring-content";
import { WeatherAlertViewer } from "@/components/weather-alert-viewer";
import {
  EMERGENCY_HOTLINES,
  EVACUATION_CENTERS,
  EVACUATION_FEATURED_CENTERS,
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
  buildReportDirectionsUrl,
  buildReportEvacuationCentersHref,
  buildReportUpdateHref,
  REPORT_ACTION_MESSAGES,
  type ReportActionLoadingState,
} from "@/lib/report-actions";
import {
  buildStoredActionKey,
  mapReportToIncident,
} from "@/lib/report-ui";
import {
  compareReportsByPriority,
  getReportFreshnessBadge,
  isRecentlyConfirmedReport,
} from "@/lib/report-trust";
import type {
  EvacuationCenterMapMarker,
  FloodAlert,
  IncidentReport,
  ReportMapMarker,
  Theme,
  WeatherOverviewData,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { fetchWeatherOverview } from "@/lib/weather-client";
import {
  createReportActionHeaders,
  REPORT_ACTION_UNDO_WINDOW_MS,
} from "@/lib/report-session";
import { getSidebarWeatherOverview } from "@/lib/weather";
import {
  hasValidCoordinates,
  matchesHighSeverityFilter,
  matchesReportStatusFilter,
  reportStatusFilterOptions,
  type ReportStatusFilterId,
} from "@/components/flood-map";

type FloodMapToastState = {
  message: string;
  tone: "success" | "error";
  actionType?: "confirmed" | "resolved";
  reportId?: string;
  expiresAt?: number;
  pending?: boolean;
} | null;

type LiveAlertGroup = {
  id: string;
  title: string;
  description: string;
  reports: IncidentReport[];
};

type LiveAlertSummary = {
  criticalCount: number;
  highRiskCount: number;
  recentlyUpdatedCount: number;
  nearbyActiveCount: number;
};

type UserLocationStatus = "idle" | "loading" | "available" | "denied" | "unavailable" | "error";

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
  advisoryMessage: "",
};

const NEARBY_REPORT_RADIUS_METERS = 15_000;

function getDistanceMeters(
  [latitudeA, longitudeA]: [number, number],
  [latitudeB, longitudeB]: [number, number],
) {
  const earthRadiusMeters = 6_371_000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(latitudeB - latitudeA);
  const longitudeDelta = toRadians(longitudeB - longitudeA);
  const originLatitude = toRadians(latitudeA);
  const targetLatitude = toRadians(latitudeB);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitude) *
      Math.cos(targetLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function FloodMapUndoToast({
  toast,
  onUndo,
  onDismiss,
}: {
  toast: Exclude<FloodMapToastState, null>;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!toast.expiresAt) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [toast.expiresAt]);

  const timeRemainingMs = toast.expiresAt
    ? Math.max(0, toast.expiresAt - now)
    : 0;
  const undoAvailable =
    Boolean(toast.actionType && toast.reportId && toast.expiresAt) &&
    timeRemainingMs > 0;
  const countdownSeconds = Math.ceil(timeRemainingMs / 1000);

  return (
    <div className="pointer-events-none fixed inset-x-4 top-[calc(var(--header-height)+1rem)] z-[var(--layer-toast)] flex justify-center md:left-[calc(var(--sidebar-width)+2rem)] md:right-6 md:justify-end">
      <div
        className={cn(
          "floodwatch-toast pointer-events-auto w-full max-w-[560px] px-4 py-3 text-[0.92rem]",
          toast.tone === "success"
            ? "floodwatch-toast--success"
            : "floodwatch-toast--error",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>{toast.message}</div>
            {undoAvailable ? (
              <div className="flex items-center gap-3">
                <div className="text-[0.78rem] font-medium opacity-75">
                  {countdownSeconds}s
                </div>
                <button
                  type="button"
                  onClick={onUndo}
                  disabled={toast.pending}
                  className={cn(
                    "floodwatch-toast-action",
                    toast.tone === "success"
                      ? "floodwatch-toast-action--success"
                      : "floodwatch-toast-action--error",
                    toast.pending && "cursor-not-allowed opacity-60",
                  )}
                >
                  {toast.pending ? "Undoing..." : "Undo"}
                </button>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={onDismiss}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-current opacity-75 transition hover:bg-black/10 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

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
  const [liveAlertsOpen, setLiveAlertsOpen] = useState(false);
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
  const [floodMapSelectedReportStatus, setFloodMapSelectedReportStatus] =
    useState<ReportStatusFilterId>(
      reportStatusFilterOptions[0].id,
    );
  const [floodMapHighSeverityOnly, setFloodMapHighSeverityOnly] = useState(false);
  const [floodMapShowReports, setFloodMapShowReports] = useState(true);
  const [floodMapShowEvacuationCenters, setFloodMapShowEvacuationCenters] = useState(true);
  const [floodMapShowRiskOverlays, setFloodMapShowRiskOverlays] = useState(false);
  const [floodMapSelectedReportId, setFloodMapSelectedReportId] = useState<string | null>(null);
  const [floodMapModalOpen, setFloodMapModalOpen] = useState(false);
  const [floodMapActionLoading, setFloodMapActionLoading] =
    useState<ReportActionLoadingState>(null);
  const [floodMapConfirmedReportIds, setFloodMapConfirmedReportIds] = useState<Record<string, boolean>>({});
  const [floodMapResolvedReportIds, setFloodMapResolvedReportIds] = useState<Record<string, boolean>>({});
  const [floodMapToast, setFloodMapToast] = useState<FloodMapToastState>(null);
  const [floodMapSelectionNotice, setFloodMapSelectionNotice] = useState<string | null>(null);
  const [weatherOverview, setWeatherOverview] = useState<WeatherOverviewData>(EMPTY_WEATHER_OVERVIEW);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [focusedCenterId, setFocusedCenterId] = useState<string | null>(null);
  const [focusedReportId, setFocusedReportId] = useState<string | null>(null);
  const [focusedAlertLocation, setFocusedAlertLocation] = useState<{
    id: string;
    coordinates: [number, number];
    zoom?: number;
  } | null>(null);
  const [weatherAlertViewerOpen, setWeatherAlertViewerOpen] = useState(false);
  const [selectedWeatherAlertId, setSelectedWeatherAlertId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [userLocationStatus, setUserLocationStatus] = useState<UserLocationStatus>("idle");
  const [userLocationError, setUserLocationError] = useState<string | null>(null);

  const requestUserLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setUserLocationStatus("unavailable");
      setUserLocationError("Location is not available in this browser.");
      return;
    }

    setUserLocationStatus("loading");
    setUserLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation([position.coords.latitude, position.coords.longitude]);
        setUserLocationStatus("available");
        setUserLocationError(null);
      },
      (error) => {
        setUserLocation(null);
        setUserLocationStatus(error.code === error.PERMISSION_DENIED ? "denied" : "error");
        setUserLocationError(
          error.code === error.PERMISSION_DENIED
            ? "Location permission is blocked for FloodWatch PH."
            : "We could not read your current location. Please try again.",
        );
      },
      {
        enableHighAccuracy: false,
        maximumAge: 5 * 60 * 1000,
        timeout: 10_000,
      },
    );
  }, []);

  useEffect(() => {
    if (!liveAlertsOpen || userLocationStatus !== "idle") {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      requestUserLocation();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [liveAlertsOpen, requestUserLocation, userLocationStatus]);

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
    if (!floodMapToast) {
      return;
    }

    const timeout = window.setTimeout(
      () => {
        setFloodMapToast((current) => {
          if (!current) {
            return current;
          }

          if (
            current.reportId === floodMapToast.reportId &&
            current.actionType === floodMapToast.actionType &&
            current.expiresAt === floodMapToast.expiresAt &&
            current.message === floodMapToast.message
          ) {
            return null;
          }

          return current;
        });
      },
      floodMapToast.expiresAt
        ? Math.max(0, floodMapToast.expiresAt - Date.now())
        : 3200,
    );

    return () => window.clearTimeout(timeout);
  }, [floodMapToast]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const centerId = new URLSearchParams(window.location.search).get("center");
    let frameId = 0;

    if (centerId) {
      frameId = window.requestAnimationFrame(() => {
        setFocusedCenterId(null);
        setFocusedCenterId(centerId);
        setFloodMapShowEvacuationCenters(true);
      });
    } else {
      frameId = window.requestAnimationFrame(() => {
        setFocusedCenterId(null);
      });
    }

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [pageMode]);

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
        setWeatherError("Weather data is temporarily unavailable. Please check PAGASA or try again later.");
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
          headers: createReportActionHeaders(),
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
    if (!isFloodMapView || typeof window === "undefined" || floodMapLoadingReports) {
      return;
    }

    const reportId = new URLSearchParams(window.location.search).get("reportId");

    if (!reportId) {
      return;
    }

    const queryReportId = reportId;
    let isMounted = true;

    async function focusReportFromQuery() {
      setSheetOpen(false);
      setLiveAlertsOpen(false);
      setFloodMapShowReports(true);
      setFloodMapHighSeverityOnly(false);
      setFocusedCenterId(null);
      setFloodMapSelectedReportId(queryReportId);
      setFloodMapSelectionNotice(null);
      setFocusedReportId(null);

      const existingReport = floodMapReports.find((report) => report.id === queryReportId);

      if (!existingReport) {
        try {
          const response = await fetch(`/api/reports/${queryReportId}`, {
            cache: "no-store",
            headers: createReportActionHeaders(),
          });
          const payload = (await response.json()) as ReportDetailResponse | { error: string };

          if (!response.ok || !("data" in payload)) {
            throw new Error("Report not found.");
          }

          if (!isMounted) {
            return;
          }

          const nextReport = mapReportToIncident(payload.data);
          setFloodMapReports((current) =>
            current.some((report) => report.id === nextReport.id)
              ? current.map((report) => (report.id === nextReport.id ? nextReport : report))
              : [nextReport, ...current],
          );
          setFloodMapUpdatesByReportId((current) => ({
            ...current,
            [queryReportId]: payload.data.updates,
          }));
        } catch (error) {
          console.error("Failed to load report from map query param.", error);
          if (isMounted) {
            setFloodMapSelectionNotice("This report may have been removed or archived.");
          }
          return;
        }
      }

      if (isMounted) {
        window.requestAnimationFrame(() => {
          setFocusedReportId(queryReportId);
        });
      }
    }

    focusReportFromQuery();

    return () => {
      isMounted = false;
    };
  }, [floodMapLoadingReports, floodMapReports, isFloodMapView]);

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
          headers: createReportActionHeaders(),
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

  const floodMapFilteredReports = useMemo(() => {
    const filteredReports = floodMapMappedReports.filter((report) => {
        if (!matchesReportStatusFilter(report, floodMapSelectedReportStatus)) {
          return false;
        }

        if (floodMapHighSeverityOnly && !matchesHighSeverityFilter(report)) {
          return false;
        }

        return true;
      });
    const selectedReport = floodMapSelectedReportId
      ? floodMapMappedReports.find((report) => report.id === floodMapSelectedReportId)
      : null;
    const shouldIncludeSelectedReport =
      selectedReport &&
      floodMapShowReports &&
      !filteredReports.some((report) => report.id === selectedReport.id);

    return (
      shouldIncludeSelectedReport
        ? [selectedReport, ...filteredReports]
        : filteredReports
    ).sort(compareReportsByPriority);
  }, [
    floodMapHighSeverityOnly,
    floodMapMappedReports,
    floodMapSelectedReportId,
    floodMapSelectedReportStatus,
    floodMapShowReports,
  ]);

  const floodMapReportMarkers = useMemo<ReportMapMarker[]>(
    () =>
      floodMapFilteredReports.map((report) => ({
        id: `report-marker-${report.id}`,
        label: "R",
        category: "report",
        severity: report.severity,
        status: report.status,
        coordinates: report.coordinates as [number, number],
        title: report.title,
        reportId: report.id,
        report,
      })),
    [floodMapFilteredReports],
  );

  const floodMapEvacuationCenterMarkers = useMemo<EvacuationCenterMapMarker[]>(
    () =>
      EVACUATION_CENTERS.map((center) => ({
        id: `center-marker-${center.id}`,
        label: "E",
        category: "center",
        coordinates: [center.latitude, center.longitude],
        title: center.name,
        centerId: center.id,
        center,
        status: center.status,
      })),
    [],
  );

  const floodMapSidebarReports = useMemo(
    () => floodMapFilteredReports.slice(0, 5),
    [floodMapFilteredReports],
  );

  const floodMapNearbyReports = useMemo(() => {
    if (!userLocation) {
      return [];
    }

    return floodMapMappedReports
      .filter((report) => matchesReportStatusFilter(report, "active"))
      .map((report) => ({
        report,
        distanceMeters: getDistanceMeters(userLocation, report.coordinates as [number, number]),
      }))
      .filter(({ distanceMeters }) => distanceMeters <= NEARBY_REPORT_RADIUS_METERS)
      .sort((first, second) => {
        const distanceDifference = first.distanceMeters - second.distanceMeters;

        if (distanceDifference !== 0) {
          return distanceDifference;
        }

        return compareReportsByPriority(first.report, second.report);
      })
      .map(({ report }) => report);
  }, [floodMapMappedReports, userLocation]);

  const floodMapLiveAlertGroups = useMemo<LiveAlertGroup[]>(() => {
    const activeReports = floodMapMappedReports
      .filter((report) => matchesReportStatusFilter(report, "active"))
      .sort(compareReportsByPriority);
    const recededReports = floodMapMappedReports
      .filter((report) => report.status === "Likely Receded")
      .sort(compareReportsByPriority);
    const assigned = new Set<string>();

    const take = (predicate: (report: IncidentReport) => boolean) => {
      const matches = activeReports.filter(
        (report) => !assigned.has(report.id) && predicate(report),
      );

      for (const report of matches) {
        assigned.add(report.id);
      }

      return matches;
    };

    const hasHigherRiskReports = activeReports.some(
      (report) =>
        report.severity === "severe" ||
        report.severity === "high" ||
        isRecentlyConfirmedReport(report) ||
        report.status === "Confirmed by Community",
    );

    return [
      {
        id: "critical",
        title: "Critical",
        description: "Highest-severity active reports that need immediate review.",
        reports: take((report) => report.severity === "severe"),
      },
      {
        id: "high-risk",
        title: "High risk",
        description: "Serious active reports with elevated flood impact.",
        reports: take((report) => report.severity === "high"),
      },
      {
        id: "recent",
        title: "Recently updated",
        description: "Active reports with fresh reports or community updates.",
        reports: take((report) => {
          const freshness = getReportFreshnessBadge(report);
          return (
            isRecentlyConfirmedReport(report) ||
            freshness?.label === "New" ||
            freshness?.label === "Recent" ||
            freshness?.label === "Recently confirmed"
          );
        }),
      },
      {
        id: "nearby",
        title: "Nearby active",
        description: "Active reports within 15 km of your current location.",
        reports: floodMapNearbyReports,
      },
      {
        id: "community-confirmed",
        title: "Community confirmed",
        description: "Reports confirmed by community members.",
        reports: take((report) => report.status === "Confirmed by Community"),
      },
      {
        id: "moderate-low",
        title: "Moderate and low active",
        description: "Lower-risk active reports shown when higher-risk alerts are quiet.",
        reports: hasHigherRiskReports
          ? []
          : take((report) => report.severity === "moderate" || report.severity === "safe"),
      },
      {
        id: "receded",
        title: "Recently receded",
        description: "Reports marked likely receded by community activity.",
        reports: recededReports,
      },
    ];
  }, [floodMapMappedReports, floodMapNearbyReports]);

  const liveAlertsCount = useMemo(() => {
    return floodMapMappedReports.filter(
      (report) =>
        matchesReportStatusFilter(report, "active") &&
        (report.severity === "severe" || report.severity === "high"),
    ).length;
  }, [floodMapMappedReports]);

  const liveAlertSummary = useMemo<LiveAlertSummary>(() => {
    const activeReports = floodMapMappedReports.filter((report) =>
      matchesReportStatusFilter(report, "active"),
    );

    return {
      criticalCount: activeReports.filter((report) => report.severity === "severe").length,
      highRiskCount: activeReports.filter((report) => report.severity === "high").length,
      recentlyUpdatedCount: activeReports.filter((report) => {
        const freshness = getReportFreshnessBadge(report);
        return (
          isRecentlyConfirmedReport(report) ||
          freshness?.label === "New" ||
          freshness?.label === "Recent" ||
          freshness?.label === "Recently confirmed"
        );
      }).length,
      nearbyActiveCount: floodMapNearbyReports.length,
    };
  }, [floodMapMappedReports, floodMapNearbyReports]);

  const floodMapSelectedReport = useMemo(
    () => floodMapReports.find((report) => report.id === floodMapSelectedReportId) ?? null,
    [floodMapReports, floodMapSelectedReportId],
  );

  useEffect(() => {
    if (!floodMapSelectedReportId || floodMapLoadingReports) {
      return;
    }

    if (floodMapSelectedReport && !hasValidCoordinates(floodMapSelectedReport)) {
      const frameId = window.requestAnimationFrame(() => {
        setFloodMapSelectionNotice("This report is hidden by the current filters.");
      });

      return () => window.cancelAnimationFrame(frameId);
    }
  }, [floodMapLoadingReports, floodMapSelectedReport, floodMapSelectedReportId]);

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
    setLiveAlertsOpen(false);
    setWeatherAlertViewerOpen(false);

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

  const findWeatherLocationForAlert = (alert: FloodAlert) =>
    weatherOverview.locations.find(
      (location) => location.name.toLowerCase() === alert.location.toLowerCase(),
    ) ?? null;

  const openWeatherAlertViewer = (alertId: string) => {
    setSheetOpen(false);
    setSidebarOpen(false);
    setLiveAlertsOpen(false);
    setSelectedWeatherAlertId(alertId);
    setWeatherAlertViewerOpen(true);
  };

  const closeWeatherAlertViewer = () => {
    setWeatherAlertViewerOpen(false);
  };

  const viewWeatherAlertOnMap = (alert: FloodAlert) => {
    const location = findWeatherLocationForAlert(alert);

    if (!location) {
      return;
    }

    setSheetOpen(false);
    setSidebarOpen(false);
    setWeatherAlertViewerOpen(false);
    setLiveAlertsOpen(false);
    setFloodMapModalOpen(false);
    setFocusedCenterId(null);
    setFocusedReportId(null);
    setFocusedAlertLocation(null);

    window.requestAnimationFrame(() => {
      setFocusedAlertLocation({
        id: alert.id,
        coordinates: [location.latitude, location.longitude],
        zoom: 12,
      });
    });
  };

  const viewAllWeatherAlerts = () => {
    setWeatherAlertViewerOpen(false);
    setSheetOpen(false);
    setSidebarOpen(false);
    setLiveAlertsOpen(false);
    router.push("/weather-monitoring");
  };

  const focusFloodMapReport = (reportId: string) => {
    setSheetOpen(false);
    setLiveAlertsOpen(false);
    setWeatherAlertViewerOpen(false);
    setFloodMapModalOpen(false);
    setFloodMapSelectedReportId(reportId);
    setFloodMapShowReports(true);
    setFloodMapHighSeverityOnly(false);
    setFocusedCenterId(null);
    setFocusedAlertLocation(null);
    setFocusedReportId(null);

    window.requestAnimationFrame(() => {
      setFocusedReportId(reportId);
    });
  };

  const openFloodMapReportDetails = (reportId: string) => {
    setSheetOpen(false);
    setLiveAlertsOpen(false);
    setWeatherAlertViewerOpen(false);
    setFloodMapShowReports(true);
    setFloodMapHighSeverityOnly(false);
    setFocusedCenterId(null);
    setFocusedAlertLocation(null);
    setFocusedReportId(reportId);
    setFloodMapSelectedReportId(reportId);
    setFloodMapModalOpen(true);
  };

  const selectFloodMapReport = (reportId: string) => {
    setFloodMapSelectionNotice(null);
    setFloodMapSelectedReportId(reportId);
    setFocusedCenterId(null);
    setFocusedAlertLocation(null);
    setFocusedReportId(reportId);
  };

  const handleReportUpdate = (report: IncidentReport) => {
    router.push(buildReportUpdateHref(report));
  };

  function applyFloodMapReportDetailPayload(payload: ReportDetailResponse) {
    const nextReport = mapReportToIncident(payload.data);

    setFloodMapReports((current) =>
      current.some((report) => report.id === nextReport.id)
        ? current
            .map((report) => (report.id === nextReport.id ? nextReport : report))
            .sort(compareReportsByPriority)
        : [nextReport, ...current].sort(compareReportsByPriority),
    );
    setFloodMapUpdatesByReportId((current) => ({
      ...current,
      [nextReport.id]: payload.data.updates,
    }));
  }

  async function handleEditFloodMapReport(report: IncidentReport, requestBody: FormData) {
    const response = await fetch(`/api/reports/${report.id}`, {
      method: "PATCH",
      headers: createReportActionHeaders(),
      body: requestBody,
    });
    const payload = (await response.json()) as ReportDetailResponse | { error?: string };

    if (!response.ok || !("data" in payload)) {
      const errorMessage =
        response.status === 403
          ? "Only the original uploader can edit this report."
          : "error" in payload && payload.error
            ? payload.error
            : "Unable to update this report.";
      setFloodMapToast({ tone: "error", message: errorMessage });
      throw new Error(errorMessage);
    }

    applyFloodMapReportDetailPayload(payload);
    setFloodMapToast({ tone: "success", message: "Report updated successfully." });
  }

  async function handleSubmitFloodMapReportUpdate(report: IncidentReport, requestBody: FormData) {
    const response = await fetch(`/api/reports/${report.id}/updates`, {
      method: "POST",
      headers: createReportActionHeaders(),
      body: requestBody,
    });
    const payload = (await response.json()) as ReportDetailResponse | { error?: string };

    if (!response.ok || !("data" in payload)) {
      const errorMessage =
        response.status === 403
          ? "Only the original uploader can edit this report."
          : "error" in payload && payload.error
            ? payload.error
            : "Unable to submit this update.";
      setFloodMapToast({ tone: "error", message: errorMessage });
      throw new Error(errorMessage);
    }

    applyFloodMapReportDetailPayload(payload);
    setFloodMapToast({ tone: "success", message: "Report updated successfully." });
  }

  const handleGetReportDirections = (report: IncidentReport) => {
    const directionsUrl = buildReportDirectionsUrl(report);

    if (!directionsUrl || typeof window === "undefined") {
      return;
    }

    window.open(directionsUrl, "_blank", "noopener,noreferrer");
  };

  const handleFindReportEvacuationCenters = (report: IncidentReport) => {
    const href = buildReportEvacuationCentersHref(report);

    if (href) {
      router.push(href);
    }
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

    setFloodMapActionLoading({ reportId, type: "confirmed" });

    try {
      const response = await fetch(`/api/reports/${reportId}/confirm`, {
        method: "POST",
        headers: createReportActionHeaders(),
      });
      const payload = (await response.json()) as { data?: ReportRecord; error?: string };

      if (!response.ok) {
          throw new Error(payload.error ?? REPORT_ACTION_MESSAGES.error);
      }

      await applyUpdatedFloodMapReport(reportId, payload, "confirmed");
      setFloodMapToast({
        tone: "success",
        message: REPORT_ACTION_MESSAGES.confirmedSuccess,
        actionType: "confirmed",
        reportId,
        expiresAt: Date.now() + REPORT_ACTION_UNDO_WINDOW_MS,
      });
    } catch (error) {
      console.error("Failed to confirm report from flood map.", error);
      if (
        error instanceof Error &&
        error.message === "This report has already been updated from this browser."
      ) {
        if (typeof window !== "undefined") {
          localStorage.setItem(buildStoredActionKey("confirmed", reportId), "true");
        }

        setFloodMapConfirmedReportIds((current) => ({
          ...current,
          [reportId]: true,
        }));
      }
      setFloodMapToast({
        tone: "error",
        message:
          error instanceof Error && error.message
            ? error.message === "This report has already been updated from this browser."
              ? REPORT_ACTION_MESSAGES.duplicate
              : error.message
            : REPORT_ACTION_MESSAGES.error,
      });
    } finally {
      setFloodMapActionLoading(null);
    }
  }

  async function handleResolveFloodMapReport(reportId: string) {
    if (floodMapResolvedReportIds[reportId]) {
      return;
    }

    setFloodMapActionLoading({ reportId, type: "resolved" });

    try {
      const response = await fetch(`/api/reports/${reportId}/resolve`, {
        method: "POST",
        headers: createReportActionHeaders(),
      });
      const payload = (await response.json()) as { data?: ReportRecord; error?: string };

      if (!response.ok) {
          throw new Error(payload.error ?? REPORT_ACTION_MESSAGES.error);
      }

      await applyUpdatedFloodMapReport(reportId, payload, "resolved");
      setFloodMapToast({
        tone: "success",
        message: REPORT_ACTION_MESSAGES.resolvedSuccess,
        actionType: "resolved",
        reportId,
        expiresAt: Date.now() + REPORT_ACTION_UNDO_WINDOW_MS,
      });
    } catch (error) {
      console.error("Failed to resolve report from flood map.", error);
      if (
        error instanceof Error &&
        error.message === "This report has already been updated from this browser."
      ) {
        if (typeof window !== "undefined") {
          localStorage.setItem(buildStoredActionKey("resolved", reportId), "true");
        }

        setFloodMapResolvedReportIds((current) => ({
          ...current,
          [reportId]: true,
        }));
      }
      setFloodMapToast({
        tone: "error",
        message:
          error instanceof Error && error.message
            ? error.message === "This report has already been updated from this browser."
              ? REPORT_ACTION_MESSAGES.duplicate
              : error.message
            : REPORT_ACTION_MESSAGES.error,
      });
    } finally {
      setFloodMapActionLoading(null);
    }
  }

  async function handleUndoFloodMapAction() {
    if (
      !floodMapToast ||
      !floodMapToast.actionType ||
      !floodMapToast.reportId ||
      !floodMapToast.expiresAt ||
      floodMapToast.pending
    ) {
      return;
    }

    if (Date.now() >= floodMapToast.expiresAt) {
      setFloodMapToast({
        tone: "error",
        message: "Undo window has expired.",
      });
      return;
    }

    const actionType = floodMapToast.actionType;
    const reportId = floodMapToast.reportId;

    setFloodMapToast((current) =>
      current &&
      current.actionType === actionType &&
      current.reportId === reportId
        ? {
            ...current,
            pending: true,
          }
        : current,
    );

    try {
      const response = await fetch(
        actionType === "confirmed"
          ? `/api/reports/${reportId}/confirm`
          : `/api/reports/${reportId}/resolve`,
        {
          method: "DELETE",
          headers: createReportActionHeaders(),
        },
      );
      const payload = (await response.json()) as { data?: ReportRecord; error?: string };

      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "Unable to undo this action.");
      }

      const nextReport = mapReportToIncident(payload.data as ReportRecord);

      setFloodMapReports((current) =>
        current.map((report) => (report.id === reportId ? nextReport : report)),
      );

      if (actionType === "confirmed") {
        setFloodMapConfirmedReportIds((current) => {
          const next = { ...current };
          delete next[reportId];
          return next;
        });
      } else {
        setFloodMapResolvedReportIds((current) => {
          const next = { ...current };
          delete next[reportId];
          return next;
        });
      }

      if (typeof window !== "undefined") {
        localStorage.removeItem(buildStoredActionKey(actionType, reportId));
      }

      setFloodMapToast({
        tone: "success",
        message: REPORT_ACTION_MESSAGES.undoSuccess,
      });
    } catch (error) {
      setFloodMapToast({
        tone: "error",
        message:
          error instanceof Error && error.message
            ? error.message
            : "Unable to undo this action.",
      });
    }
  }

  return (
    <div className="h-[100dvh] overflow-hidden bg-[var(--color-background)] text-[var(--color-foreground)]">
      <AppHeader
        activeItemLabel={NAV_ITEMS.find((item) => item.id === activeItem)?.label ?? "Flood Map"}
        theme={theme}
        liveAlertsCount={isFloodMapView ? liveAlertsCount : 0}
        liveAlertsEnabled={isFloodMapView}
        onOpenLiveAlerts={() => {
          if (!isFloodMapView) {
            return;
          }

          setSheetOpen(false);
          setLiveAlertsOpen(true);
        }}
        onToggleTheme={toggleTheme}
        onOpenSidebar={() => setSidebarOpen(true)}
        onReportFlood={() => router.push("/incident-reports")}
      />

      <div
        className="pt-[var(--header-height)]"
      >
        <div
          className={cn(
            "grid h-[calc(100dvh-var(--header-height))] min-h-0 bg-[var(--color-background)]",
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
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted-foreground)]">
                    Loading evacuation centers...
                  </div>
                }
              >
                <EvacuationCentersContent />
              </Suspense>
            ) : isIncidentReportsView ? (
              <IncidentReportsContent />
            ) : isEmergencyHotlinesView ? (
              <EmergencyHotlinesContent />
            ) : isAboutView ? (
              <AboutContent />
            ) : (
              <div className="h-full min-h-0 w-full">
                <FloodMap
                  polygons={FLOOD_POLYGONS}
                  legend={isFloodMapView ? REPORT_MARKER_LEGEND : FLOOD_LEGEND}
                  allowPolygonToggle={isFloodMapView}
                  showRiskOverlays={floodMapShowRiskOverlays}
                  onToggleRiskOverlays={() =>
                    setFloodMapShowRiskOverlays((current) => !current)
                  }
                  reportMarkers={floodMapReportMarkers}
                  evacuationCenterMarkers={floodMapEvacuationCenterMarkers}
                  showFloodReports={floodMapShowReports}
                  showEvacuationCenters={floodMapShowEvacuationCenters}
                  onToggleFloodReports={() => setFloodMapShowReports((current) => !current)}
                  onToggleEvacuationCenters={() =>
                    setFloodMapShowEvacuationCenters((current) => {
                      const next = !current;
                      if (!next) {
                        setFocusedCenterId(null);
                      }
                      return next;
                    })
                  }
                  focusedCenterId={focusedCenterId}
                  focusedReportId={focusedReportId}
                  focusedAlertLocation={focusedAlertLocation}
                  selectedReportId={floodMapSelectedReportId}
                  selectedReportStatus={floodMapSelectedReportStatus}
                  onSelectReportStatus={setFloodMapSelectedReportStatus}
                  highSeverityOnly={floodMapHighSeverityOnly}
                  onToggleHighSeverityOnly={() =>
                    setFloodMapHighSeverityOnly((current) => !current)
                  }
                  loadingReports={floodMapLoadingReports}
                  reportLoadError={floodMapReportLoadError}
                  selectionNotice={floodMapSelectionNotice}
                  actionLoading={floodMapActionLoading}
                  confirmedReportIds={floodMapConfirmedReportIds}
                  resolvedReportIds={floodMapResolvedReportIds}
                  onSelectReport={selectFloodMapReport}
                  onOpenReportDetails={openFloodMapReportDetails}
                  onConfirmReport={handleConfirmFloodMapReport}
                  onResolveReport={handleResolveFloodMapReport}
                />
              </div>
            )}

            <div className="pointer-events-none absolute inset-x-0 bottom-6 z-[var(--layer-mobile-fab)] flex items-end justify-between px-4 md:hidden">
              {!isContentOnlyView || isFloodMapView ? (
                <button
                  type="button"
                  onClick={() => setSheetOpen(true)}
                  className="floodwatch-primary-action pointer-events-auto flex h-12 items-center gap-2 rounded-full px-5 text-sm font-semibold"
                >
                  <SquareStack className="h-4 w-4" />
                  <span>Live Info</span>
                </button>
              ) : (
                <div />
              )}

              {!isIncidentReportsView ? (
                <button
                  type="button"
                  onClick={() => router.push("/incident-reports")}
                  className="floodwatch-accent-action pointer-events-auto flex h-12 items-center gap-2 rounded-full px-5 text-sm font-semibold"
                >
                  <Plus className="h-4 w-4" />
                  <span>{REPORT_LABEL.replace("Incident", "").trim()}</span>
                </button>
              ) : null}
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
               centers={EVACUATION_FEATURED_CENTERS}
              hotlines={EMERGENCY_HOTLINES}
              hotlineNotice={HOTLINE_NOTICE}
              timestamp={weatherOverview.fetchedAt || LIVE_TIMESTAMP}
              officialAlertsTitle={
                isFloodMapView
                  ? "Official and system flood alerts"
                  : "Official flood alerts"
              }
              showCommunityReportsSection={isFloodMapView}
              communityReports={floodMapSidebarReports}
              communityReportsLoading={floodMapLoadingReports}
              communityReportsError={floodMapReportLoadError}
              onViewCommunityReport={openFloodMapReportDetails}
              onViewAlert={openWeatherAlertViewer}
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
           centers={EVACUATION_FEATURED_CENTERS}
          hotlines={EMERGENCY_HOTLINES}
          hotlineNotice={HOTLINE_NOTICE}
          timestamp={weatherOverview.fetchedAt || LIVE_TIMESTAMP}
          officialAlertsTitle={
            isFloodMapView
              ? "Official and system flood alerts"
              : "Official flood alerts"
          }
          showCommunityReportsSection={isFloodMapView}
          communityReports={floodMapSidebarReports}
          communityReportsLoading={floodMapLoadingReports}
          communityReportsError={floodMapReportLoadError}
          onViewCommunityReport={openFloodMapReportDetails}
          onViewAlert={openWeatherAlertViewer}
          communityReportsDisclaimer="Community reports may be unverified."
        />
      ) : null}

      {isFloodMapView ? (
        <WeatherAlertViewer
          open={weatherAlertViewerOpen}
          alerts={weatherOverview.alerts}
          initialAlertId={selectedWeatherAlertId}
          canViewAlertOnMap={(alert) => Boolean(findWeatherLocationForAlert(alert))}
          onClose={closeWeatherAlertViewer}
          onViewOnMap={viewWeatherAlertOnMap}
          onViewAllAlerts={viewAllWeatherAlerts}
        />
      ) : null}

      {isFloodMapView ? (
        <LiveAlertsPanel
          open={liveAlertsOpen}
          loading={floodMapLoadingReports}
          error={floodMapReportLoadError}
          groups={floodMapLiveAlertGroups}
          summary={liveAlertSummary}
          nearbyLocationStatus={userLocationStatus}
          nearbyLocationError={userLocationError}
          nearbyRadiusLabel="15 km"
          onRequestNearbyLocation={requestUserLocation}
          onClose={() => setLiveAlertsOpen(false)}
          onViewOnMap={focusFloodMapReport}
          onViewDetails={openFloodMapReportDetails}
          onViewAllReports={() => {
            setLiveAlertsOpen(false);
            router.push("/incident-reports");
          }}
          onOpenFloodMap={() => setLiveAlertsOpen(false)}
          onReportFlood={() => {
            setLiveAlertsOpen(false);
            router.push("/incident-reports");
          }}
          onFindEvacuationCenters={() => {
            setLiveAlertsOpen(false);
            router.push("/evacuation-centers");
          }}
          onReviewWeatherRisk={() => {
            setLiveAlertsOpen(false);
            router.push("/weather-monitoring");
          }}
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
          actionLoading={floodMapActionLoading}
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
          onEditReport={handleEditFloodMapReport}
          onSubmitReportUpdate={handleSubmitFloodMapReportUpdate}
          onReportUpdate={handleReportUpdate}
          onGetDirections={handleGetReportDirections}
          onFindEvacuationCenters={handleFindReportEvacuationCenters}
          onOpenChange={(open) => {
            setFloodMapModalOpen(open);
          }}
        />
      ) : null}

      {isFloodMapView && floodMapToast ? (
        <FloodMapUndoToast
          toast={floodMapToast}
          onUndo={handleUndoFloodMapAction}
          onDismiss={() => setFloodMapToast(null)}
        />
      ) : null}
    </div>
  );
}
