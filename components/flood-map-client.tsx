"use client";

import "leaflet/dist/leaflet.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.Default.css";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Clock3,
  Eye,
  LocateFixed,
  Map,
  Navigation,
  Satellite,
  ThumbsUp,
} from "lucide-react";
import L from "leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import {
  MapContainer,
  Marker,
  Polygon,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";

import {
  buildCenterDetailsHref,
  buildDirectionsUrl,
  EVACUATION_STATUS_META,
  summarizeEvacuationFacilities,
} from "@/lib/emergency-resources";
import {
  panToReportWithOffset,
  type FocusableLeafletMarker,
} from "@/lib/map-focus";
import {
  buildReportDirectionsUrl,
  getReportActionLabel,
  isReportActionLoading,
  type ReportActionLoadingState,
} from "@/lib/report-actions";
import { formatCountLabel } from "@/lib/reporting";
import {
  getStatusPresentation,
  severityBadgeClasses,
  severityLabels,
} from "@/lib/report-ui";
import {
  getReportActivityLabel,
  getReportFreshnessBadge,
} from "@/lib/report-trust";
import type {
  EvacuationCenterMapMarker,
  LegendItem,
  ReportMapMarker,
  RiskPolygon,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const DEFAULT_CENTER: [number, number] = [14.6176, 121.0325];
const DEFAULT_ZOOM = 10;
const MOBILE_SELECTED_REPORT_ZOOM = 15;
const MOBILE_SELECTED_REPORT_DOWN_OFFSET = 56;
const STREET_TILES = {
  url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: "&copy; OpenStreetMap",
};
const SATELLITE_TILES = {
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  attribution: "Tiles &copy; Esri",
};
const MOBILE_BREAKPOINT_PX = 768;

const severityColorMap = {
  safe: "var(--color-success)",
  moderate: "var(--color-warning)",
  high: "var(--color-high)",
  severe: "var(--color-danger)",
};

const reportMarkerStatusStyles = {
  "Needs More Confirmation": {
    color: "var(--color-warning)",
    ring: "color-mix(in srgb, var(--color-warning) 18%, transparent)",
    border: "color-mix(in srgb, var(--color-warning) 55%, white)",
    opacity: 1,
  },
  "Confirmed by Community": {
    color: "var(--color-danger)",
    ring: "color-mix(in srgb, var(--color-danger) 18%, transparent)",
    border: "color-mix(in srgb, var(--color-danger) 55%, white)",
    opacity: 1,
  },
  "Likely Receded": {
    color: "var(--color-muted-foreground)",
    ring: "color-mix(in srgb, var(--color-muted-foreground) 16%, transparent)",
    border: "color-mix(in srgb, var(--color-border) 72%, transparent)",
    opacity: 0.72,
  },
  Resolved: {
    color: "var(--color-disabled-text)",
    ring: "color-mix(in srgb, var(--color-disabled-text) 12%, transparent)",
    border: "color-mix(in srgb, var(--color-disabled-border) 88%, transparent)",
    opacity: 0.58,
  },
} as const;

type CenterMarkerInstance = {
  openPopup: () => void;
  getLatLng: () => { lat: number; lng: number };
  _map?: {
    flyTo: (
      center: { lat: number; lng: number },
      zoom: number,
      options?: Record<string, unknown>,
    ) => void;
    panBy?: (
      offset: [number, number],
      options?: Record<string, unknown>,
    ) => void;
  };
};

type ReportMarkerInstance = FocusableLeafletMarker;

function openReportMarkerCentered(
  marker: FocusableLeafletMarker,
  options: { zoom?: number; flyDuration?: number; reopenDelayMs?: number } = {},
) {
  const targetLatLng = marker.getLatLng();

  marker.openPopup();
  marker._map?.flyTo(targetLatLng, options.zoom ?? MOBILE_SELECTED_REPORT_ZOOM, {
    duration: options.flyDuration ?? 0.45,
  });

  if (typeof window === "undefined") {
    return;
  }

  window.setTimeout(() => {
    marker.openPopup();
    marker._map?.panBy?.([0, MOBILE_SELECTED_REPORT_DOWN_OFFSET], {
      animate: true,
      duration: 0.25,
    });
  }, options.reopenDelayMs ?? 180);
}

function isMobileViewport() {
  return typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT_PX;
}

function iconForReportMarker(marker: ReportMapMarker, selected: boolean, mobilePerformanceMode: boolean) {
  const markerStyle = reportMarkerStatusStyles[marker.status];
  const markerClassName = mobilePerformanceMode
    ? `floodwatch-marker-mobile${selected ? " floodwatch-marker-mobile--selected" : ""}`
    : `floodwatch-marker${selected ? " floodwatch-marker--selected" : ""}`;
  const iconSize: [number, number] = mobilePerformanceMode
    ? selected
      ? [30, 30]
      : [24, 24]
    : selected
      ? [38, 38]
      : [32, 32];
  const iconAnchor: [number, number] = [iconSize[0] / 2, iconSize[1] / 2];

  return L.divIcon({
    className: "floodwatch-marker-shell",
    html: `<div class="${markerClassName}" style="--marker-color:${markerStyle.color};--marker-ring:${markerStyle.ring};--marker-border:${markerStyle.border};opacity:${markerStyle.opacity}">R</div>`,
    iconSize,
    iconAnchor,
  });
}

function iconForCenterMarker(marker: EvacuationCenterMapMarker, selected: boolean, mobilePerformanceMode: boolean) {
  const statusMeta = EVACUATION_STATUS_META[marker.status];
  const markerClassName = mobilePerformanceMode
    ? `floodwatch-marker-mobile floodwatch-marker-mobile--center${selected ? " floodwatch-marker-mobile--selected" : ""}`
    : `floodwatch-marker${selected ? " floodwatch-marker--selected" : ""}`;
  const iconSize: [number, number] = mobilePerformanceMode
    ? selected
      ? [30, 30]
      : [24, 24]
    : [34, 34];
  const iconAnchor: [number, number] = [iconSize[0] / 2, iconSize[1] / 2];

  return L.divIcon({
    className: "floodwatch-marker-shell",
    html: `<div class="${markerClassName}" style="--marker-color:${statusMeta.markerColor};--marker-ring:${statusMeta.markerRing};--marker-border:rgba(255,255,255,0.92)">E</div>`,
    iconSize,
    iconAnchor,
  });
}

function useMobilePerformanceMode() {
  const [mobilePerformanceMode, setMobilePerformanceMode] = useState(isMobileViewport);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let frameId = 0;

    function updateMobileMode() {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        setMobilePerformanceMode(isMobileViewport());
      });
    }

    updateMobileMode();
    window.addEventListener("resize", updateMobileMode);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updateMobileMode);
    };
  }, []);

  return mobilePerformanceMode;
}

type MapZoomControlsProps = {
  satelliteMode: boolean;
  onToggleSatellite: () => void;
};

type FocusedMapLocation = {
  id: string;
  coordinates: [number, number];
  zoom?: number;
} | null;

function FocusMapLocation({ location }: { location: FocusedMapLocation }) {
  const map = useMap();

  useEffect(() => {
    if (!location) {
      return;
    }

    map.flyTo(location.coordinates, location.zoom ?? 12, { duration: 1.05 });
  }, [location, map]);

  return null;
}

function MapZoomControls({
  satelliteMode,
  onToggleSatellite,
}: MapZoomControlsProps) {
  const map = useMap();

  return (
    <div className="map-floating-controls">
      <button
        type="button"
        aria-label="Locate map center"
        onClick={() => map.flyTo(DEFAULT_CENTER, DEFAULT_ZOOM, { duration: 1.2 })}
      >
        <LocateFixed className="h-4.5 w-4.5" />
      </button>
      <button type="button" aria-label="Zoom in" onClick={() => map.zoomIn()}>
        +
      </button>
      <button type="button" aria-label="Zoom out" onClick={() => map.zoomOut()}>
        -
      </button>
      <button
        type="button"
        aria-label={satelliteMode ? "Disable satellite mode" : "Enable satellite mode"}
        aria-pressed={satelliteMode}
        onClick={onToggleSatellite}
        className={satelliteMode ? "is-active" : ""}
      >
        {satelliteMode ? (
          <Map className="h-4.5 w-4.5" />
        ) : (
          <Satellite className="h-4.5 w-4.5" />
        )}
      </button>
    </div>
  );
}

type MapInteractionTrackerProps = {
  enabled: boolean;
  onInteractionChange: (interacting: boolean) => void;
  onInteractionStart?: () => void;
};

type EventedMap = {
  on: (eventName: string, handler: () => void) => void;
  off: (eventName: string, handler: () => void) => void;
};

function MapInteractionTracker({
  enabled,
  onInteractionChange,
  onInteractionStart,
}: MapInteractionTrackerProps) {
  const map = useMap() as unknown as EventedMap;
  const interactionDepthRef = useRef(0);

  const startInteraction = useCallback(() => {
    if (!enabled) {
      return;
    }

    interactionDepthRef.current += 1;
    if (interactionDepthRef.current === 1) {
      onInteractionChange(true);
      onInteractionStart?.();
    }
  }, [enabled, onInteractionChange, onInteractionStart]);

  const endInteraction = useCallback(() => {
    if (!enabled) {
      return;
    }

    interactionDepthRef.current = Math.max(0, interactionDepthRef.current - 1);
    if (interactionDepthRef.current === 0) {
      onInteractionChange(false);
    }
  }, [enabled, onInteractionChange]);

  useEffect(() => {
    map.on("movestart", startInteraction);
    map.on("zoomstart", startInteraction);
    map.on("dragstart", startInteraction);
    map.on("moveend", endInteraction);
    map.on("zoomend", endInteraction);
    map.on("dragend", endInteraction);

    return () => {
      map.off("movestart", startInteraction);
      map.off("zoomstart", startInteraction);
      map.off("dragstart", startInteraction);
      map.off("moveend", endInteraction);
      map.off("zoomend", endInteraction);
      map.off("dragend", endInteraction);
    };
  }, [endInteraction, map, startInteraction]);

  return null;
}

type ReportPopupContentProps = {
  marker: ReportMapMarker;
  onOpenReportDetails: (reportId: string) => void;
  onConfirmReport: (reportId: string) => void;
  onResolveReport: (reportId: string) => void;
  actionLoading: ReportActionLoadingState;
  confirmedReportIds: Record<string, boolean>;
  resolvedReportIds: Record<string, boolean>;
};

const ReportPopupContent = memo(function ReportPopupContent({
  marker,
  onOpenReportDetails,
  onConfirmReport,
  onResolveReport,
  actionLoading,
  confirmedReportIds,
  resolvedReportIds,
}: ReportPopupContentProps) {
  const statusPresentation = getStatusPresentation(marker.report.status);
  const freshnessBadge = getReportFreshnessBadge(marker.report);
  const activityLabel = getReportActivityLabel(marker.report);
  const thumbnailUrl = marker.report.photos[0]?.imageUrl;
  const directionsUrl = buildReportDirectionsUrl(marker.report);
  const confirmLoading = isReportActionLoading(
    actionLoading,
    marker.reportId,
    "confirmed",
  );
  const resolveLoading = isReportActionLoading(
    actionLoading,
    marker.reportId,
    "resolved",
  );
  const actionBusy = isReportActionLoading(actionLoading, marker.reportId);
  const hasConfirmed = Boolean(confirmedReportIds[marker.reportId]);
  const hasResolved = Boolean(resolvedReportIds[marker.reportId]);
  const isResolved = marker.report.status === "Resolved";

  return (
    <div className="w-[276px] space-y-2.5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <div className="min-w-0">
          <div className="mb-1 inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[0.62rem] font-semibold text-blue-700">
            Selected
          </div>
          <div className="line-clamp-2 text-[0.94rem] font-semibold leading-5 text-slate-900">
            {marker.report.title}
          </div>
          <div className="mt-0.5 line-clamp-1 text-[0.76rem] text-slate-600">
            {marker.report.location}
          </div>
        </div>
        {thumbnailUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={thumbnailUrl}
            alt={marker.report.title}
            loading="lazy"
            decoding="async"
            className="h-12 w-12 rounded-[10px] object-cover"
          />
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[0.66rem] font-semibold",
            severityBadgeClasses[marker.report.severity],
          )}
        >
          {severityLabels[marker.report.severity]}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.66rem] font-medium",
            statusPresentation.textClassName,
            statusPresentation.wrapperClassName,
          )}
        >
          <span className={cn("h-2 w-2 rounded-full", statusPresentation.dotClassName)} />
          <span>{statusPresentation.label}</span>
        </span>
        {freshnessBadge ? (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[0.66rem] font-medium",
              freshnessBadge.tone === "success"
                ? "bg-[var(--color-success-surface)] text-[var(--color-success-text)]"
                : freshnessBadge.tone === "warning"
                  ? "bg-[var(--color-warning-surface)] text-[var(--color-warning-text)]"
                  : freshnessBadge.tone === "muted"
                    ? "bg-[var(--color-muted-surface)] text-[var(--color-muted-text)]"
                    : "bg-[var(--color-info-surface)] text-[var(--color-info-text)]",
            )}
          >
            {freshnessBadge.label}
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2 text-[0.74rem] text-slate-600">
        <div className="rounded-[10px] bg-slate-100 px-2.5 py-2">
          <div className="flex items-center gap-1.5">
            <ThumbsUp className="h-3.5 w-3.5" />
            <span>{formatCountLabel(marker.report.confirmations)}</span>
          </div>
        </div>
        <div className="rounded-[10px] bg-slate-100 px-2.5 py-2">
          <div className="flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5" />
            <span>{formatCountLabel(marker.report.resolvedConfirmations)} receded</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-[0.75rem] text-slate-500">
        <Clock3 className="h-3.5 w-3.5" />
        <span>{activityLabel}</span>
      </div>

      <p className="line-clamp-2 text-[0.75rem] leading-5 text-slate-600">
        {marker.report.description}
      </p>

      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => onOpenReportDetails(marker.reportId)}
          className="floodwatch-primary-action inline-flex h-8 items-center justify-center gap-1.5 rounded-[9px] px-2 text-[0.7rem] font-semibold"
        >
          <Eye className="h-3.5 w-3.5" />
          <span>View Details</span>
        </button>
        {directionsUrl ? (
          <a
            href={directionsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[9px] border border-slate-200 bg-white px-2 text-[0.7rem] font-semibold text-slate-700 no-underline"
          >
            <Navigation className="h-3.5 w-3.5" />
            <span>Directions</span>
          </a>
        ) : null}
        <button
          type="button"
          onClick={() => onConfirmReport(marker.reportId)}
          disabled={actionBusy || hasConfirmed || isResolved}
          className={cn(
            "inline-flex h-8 items-center justify-center gap-1.5 rounded-[9px] px-2 text-[0.7rem] font-semibold",
            actionBusy || hasConfirmed || isResolved
              ? "bg-slate-100 text-slate-500"
              : "bg-blue-600 text-white",
          )}
        >
          <ThumbsUp className="h-3.5 w-3.5" />
          <span>
            {getReportActionLabel({
              type: "confirmed",
              loading: confirmLoading,
              alreadySubmitted: hasConfirmed,
              compact: true,
            })}
          </span>
        </button>
        <button
          type="button"
          onClick={() => onResolveReport(marker.reportId)}
          disabled={actionBusy || hasResolved || isResolved}
          className={cn(
            "inline-flex h-8 items-center justify-center gap-1.5 rounded-[9px] border px-2 text-[0.7rem] font-semibold",
            actionBusy || hasResolved || isResolved
              ? "border-slate-200 bg-slate-100 text-slate-500"
              : "border-slate-200 bg-white text-slate-700",
          )}
        >
          <Check className="h-3.5 w-3.5" />
          <span>
            {getReportActionLabel({
              type: "resolved",
              loading: resolveLoading,
              alreadySubmitted: hasResolved,
              compact: true,
            })}
          </span>
        </button>
      </div>
    </div>
  );
});

function CenterPopupContent({ marker }: { marker: EvacuationCenterMapMarker }) {
  const facilitySummary = summarizeEvacuationFacilities(marker.center.facilities, 3);

  return (
    <div className="w-[240px] space-y-3">
      <div>
        <div className="text-[0.98rem] font-semibold text-slate-900">
          {marker.center.name}
        </div>
        <div className="mt-1 text-[0.8rem] text-slate-600">
          {marker.center.address}
        </div>
        <div className="mt-1 text-[0.75rem] font-medium text-slate-500">
          {EVACUATION_STATUS_META[marker.center.status].label}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {facilitySummary.visible.map((facilityLabel, index) => (
          <span
            key={`${marker.center.id}-${facilityLabel}-${index}`}
            className="rounded-full bg-slate-100 px-2 py-1 text-[0.68rem] font-medium text-slate-700"
          >
            {facilityLabel}
          </span>
        ))}
        {facilitySummary.remaining > 0 ? (
          <span className="rounded-full bg-slate-100 px-2 py-1 text-[0.68rem] font-medium text-slate-700">
            +{facilitySummary.remaining} more
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-2">
        <a
          href={buildCenterDetailsHref(marker.center.id)}
          className="inline-flex h-9 items-center justify-center rounded-[10px] border border-slate-200 bg-white px-3 text-[0.75rem] font-semibold text-slate-700 no-underline"
        >
          View Details
        </a>
        <a
          href={buildDirectionsUrl(marker.center)}
          target="_blank"
          rel="noreferrer"
          className="floodwatch-primary-action inline-flex h-9 items-center justify-center rounded-[10px] px-3 text-[0.75rem] font-semibold !text-white no-underline"
        >
          Get Directions
        </a>
      </div>
    </div>
  );
}

type FloodMapClientProps = {
  reportMarkers: ReportMapMarker[];
  evacuationCenterMarkers: EvacuationCenterMapMarker[];
  polygons: RiskPolygon[];
  legend: LegendItem[];
  onOpenReportDetails: (reportId: string) => void;
  onSelectReport: (reportId: string) => void;
  onConfirmReport: (reportId: string) => void;
  onResolveReport: (reportId: string) => void;
  actionLoading: ReportActionLoadingState;
  confirmedReportIds: Record<string, boolean>;
  resolvedReportIds: Record<string, boolean>;
  focusedCenterId?: string | null;
  focusedReportId?: string | null;
  selectedReportId?: string | null;
  focusedAlertLocation?: FocusedMapLocation;
  onMapInteractionStart?: () => void;
};

export function FloodMapClient({
  reportMarkers,
  evacuationCenterMarkers,
  polygons,
  onOpenReportDetails,
  onSelectReport,
  onConfirmReport,
  onResolveReport,
  actionLoading,
  confirmedReportIds,
  resolvedReportIds,
  focusedCenterId = null,
  focusedReportId = null,
  selectedReportId = null,
  focusedAlertLocation = null,
  onMapInteractionStart,
}: FloodMapClientProps) {
  const [satelliteMode, setSatelliteMode] = useState(false);
  const [mapInteracting, setMapInteracting] = useState(false);
  const [selectedCenterId, setSelectedCenterId] = useState<string | null>(null);
  const centerMarkerRefs = useRef<Record<string, CenterMarkerInstance | null>>({});
  const reportMarkerRefs = useRef<Record<string, ReportMarkerInstance | null>>({});
  const selectedReportOpenReasonRef = useRef<"marker-click" | "external">("external");
  const mobilePerformanceMode = useMobilePerformanceMode();
  const tileConfig = useMemo(
    () => (satelliteMode ? SATELLITE_TILES : STREET_TILES),
    [satelliteMode],
  );
  const reportClusterOptions = useMemo(
    () => ({
      chunkedLoading: true,
      chunkDelay: mobilePerformanceMode ? 40 : 20,
      chunkInterval: mobilePerformanceMode ? 130 : 200,
      maxClusterRadius: mobilePerformanceMode ? 88 : 56,
      removeOutsideVisibleBounds: true,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: !mobilePerformanceMode,
    }),
    [mobilePerformanceMode],
  );
  const centerClusterOptions = useMemo(
    () => ({
      chunkedLoading: true,
      chunkDelay: 40,
      chunkInterval: 130,
      maxClusterRadius: 84,
      removeOutsideVisibleBounds: true,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: false,
    }),
    [],
  );
  const handleMapInteractionChange = useCallback((interacting: boolean) => {
    setMapInteracting(interacting);
  }, []);

  useEffect(() => {
    if (!focusedCenterId) {
      return;
    }

    let frameId = 0;
    let timeoutId = 0;

    const focusTargetMarker = () => {
      const targetMarker = centerMarkerRefs.current[focusedCenterId];
      if (!targetMarker) {
        timeoutId = window.setTimeout(() => {
          frameId = window.requestAnimationFrame(focusTargetMarker);
        }, 120);
        return;
      }

      const targetLatLng = targetMarker.getLatLng();
      setSelectedCenterId(focusedCenterId);
      targetMarker.openPopup();
      targetMarker._map?.flyTo(targetLatLng, 13, { duration: 1.1 });
    };

    frameId = window.requestAnimationFrame(focusTargetMarker);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [focusedCenterId, evacuationCenterMarkers]);

  useEffect(() => {
    if (!focusedReportId) {
      return;
    }

    let frameId = 0;
    let timeoutId = 0;

    const focusTargetMarker = () => {
      const targetMarker = reportMarkerRefs.current[focusedReportId];
      if (!targetMarker) {
        timeoutId = window.setTimeout(() => {
          frameId = window.requestAnimationFrame(focusTargetMarker);
        }, 120);
        return;
      }

      if (mobilePerformanceMode) {
        openReportMarkerCentered(targetMarker);
        return;
      }

      panToReportWithOffset(targetMarker, { reason: "external" });
    };

    frameId = window.requestAnimationFrame(focusTargetMarker);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [focusedReportId, mobilePerformanceMode, reportMarkers]);

  useEffect(() => {
    if (!selectedReportId) {
      return;
    }

    let frameId = 0;
    let timeoutId = 0;

    const openSelectedReport = () => {
      const targetMarker = reportMarkerRefs.current[selectedReportId];
      if (!targetMarker) {
        timeoutId = window.setTimeout(() => {
          frameId = window.requestAnimationFrame(openSelectedReport);
        }, 80);
        return;
      }

      if (mobilePerformanceMode) {
        openReportMarkerCentered(targetMarker);
      } else {
        panToReportWithOffset(targetMarker, {
          reason: selectedReportOpenReasonRef.current,
        });
      }
      selectedReportOpenReasonRef.current = "external";
    };

    frameId = window.requestAnimationFrame(openSelectedReport);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [mobilePerformanceMode, selectedReportId]);

  useEffect(() => {
    if (!selectedCenterId) {
      return;
    }

    let frameId = 0;
    let timeoutId = 0;

    const openSelectedCenter = () => {
      const targetMarker = centerMarkerRefs.current[selectedCenterId];
      if (!targetMarker) {
        timeoutId = window.setTimeout(() => {
          frameId = window.requestAnimationFrame(openSelectedCenter);
        }, 80);
        return;
      }

      targetMarker.openPopup();
    };

    frameId = window.requestAnimationFrame(openSelectedCenter);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [selectedCenterId]);

  const renderCenterMarker = useCallback(
    (marker: EvacuationCenterMapMarker) => {
      const isSelected = selectedCenterId === marker.centerId;

      return (
        <Marker
          key={marker.id}
          position={marker.coordinates}
          icon={iconForCenterMarker(marker, isSelected, mobilePerformanceMode)}
          title={marker.title}
          ref={(instance: CenterMarkerInstance | null) => {
            centerMarkerRefs.current[marker.centerId] = instance;
          }}
          eventHandlers={{
            click: () => {
              const targetMarker = centerMarkerRefs.current[marker.centerId];
              if (!targetMarker) {
                return;
              }

              setSelectedCenterId(marker.centerId);
              const targetLatLng = targetMarker.getLatLng();
              targetMarker._map?.flyTo(targetLatLng, 13, {
                duration: mobilePerformanceMode ? 0.45 : 0.9,
              });
            },
          }}
        >
          {isSelected ? (
            <Popup>
              <CenterPopupContent marker={marker} />
            </Popup>
          ) : null}
        </Marker>
      );
    },
    [mobilePerformanceMode, selectedCenterId],
  );

  return (
    <div
      className={cn(
        "relative h-full min-h-0 w-full overflow-hidden",
        mobilePerformanceMode && "floodwatch-map-performance",
        mapInteracting && "floodwatch-map-interacting",
      )}
    >
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        zoomControl={false}
        attributionControl
        preferCanvas
        className={cn(
          "floodwatch-leaflet h-full w-full",
          satelliteMode && "is-satellite",
        )}
      >
        <TileLayer
          attribution={tileConfig.attribution}
          url={tileConfig.url}
          updateWhenIdle={mobilePerformanceMode}
          updateWhenZooming={!mobilePerformanceMode}
          keepBuffer={mobilePerformanceMode ? 2 : 4}
        />
        <MapInteractionTracker
          enabled={mobilePerformanceMode}
          onInteractionChange={handleMapInteractionChange}
          onInteractionStart={onMapInteractionStart}
        />
        <FocusMapLocation location={focusedAlertLocation} />

        {polygons.map((polygon) => (
          <Polygon
            key={polygon.id}
            positions={polygon.positions}
            pathOptions={{
              color: severityColorMap[polygon.severity],
              weight: 2,
              opacity: 0.95,
              fillColor: severityColorMap[polygon.severity],
              fillOpacity: 0.18,
            }}
          />
        ))}

        <MarkerClusterGroup {...reportClusterOptions}>
          {reportMarkers.map((marker) => {
            const isSelected = selectedReportId === marker.reportId;

            return (
              <Marker
                key={marker.id}
                position={marker.coordinates}
                icon={iconForReportMarker(marker, isSelected, mobilePerformanceMode)}
                title={marker.title}
                ref={(instance: ReportMarkerInstance | null) => {
                  reportMarkerRefs.current[marker.reportId] = instance;
                }}
                eventHandlers={{
                  click: () => {
                    const targetMarker = reportMarkerRefs.current[marker.reportId];
                    if (!targetMarker) {
                      return;
                    }

                    onSelectReport(marker.reportId);
                    selectedReportOpenReasonRef.current = "marker-click";
                    targetMarker._map?.flyTo(
                      targetMarker.getLatLng(),
                      mobilePerformanceMode ? MOBILE_SELECTED_REPORT_ZOOM : 13,
                      {
                      duration: mobilePerformanceMode ? 0.45 : 0.9,
                      },
                    );
                  },
                }}
              >
                {isSelected ? (
                  <Popup>
                    <ReportPopupContent
                      marker={marker}
                      onOpenReportDetails={onOpenReportDetails}
                      onConfirmReport={onConfirmReport}
                      onResolveReport={onResolveReport}
                      actionLoading={actionLoading}
                      confirmedReportIds={confirmedReportIds}
                      resolvedReportIds={resolvedReportIds}
                    />
                  </Popup>
                ) : null}
              </Marker>
            );
          })}
        </MarkerClusterGroup>

        {mobilePerformanceMode ? (
          <MarkerClusterGroup {...centerClusterOptions}>
            {evacuationCenterMarkers.map(renderCenterMarker)}
          </MarkerClusterGroup>
        ) : (
          evacuationCenterMarkers.map(renderCenterMarker)
        )}

        <MapZoomControls
          satelliteMode={satelliteMode}
          onToggleSatellite={() => setSatelliteMode((current) => !current)}
        />
      </MapContainer>
    </div>
  );
}
