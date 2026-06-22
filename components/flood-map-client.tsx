"use client";

import "leaflet/dist/leaflet.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.Default.css";

import { useEffect, useRef, useState } from "react";
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
const STREET_TILES = {
  url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: "&copy; OpenStreetMap",
};
const SATELLITE_TILES = {
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  attribution: "Tiles &copy; Esri",
};

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

function iconForReportMarker(marker: ReportMapMarker, selected: boolean) {
  const markerStyle = reportMarkerStatusStyles[marker.status];

  return L.divIcon({
    className: "floodwatch-marker-shell",
    html: `<div class="floodwatch-marker${selected ? " floodwatch-marker--selected" : ""}" style="--marker-color:${markerStyle.color};--marker-ring:${markerStyle.ring};--marker-border:${markerStyle.border};opacity:${markerStyle.opacity}">R</div>`,
    iconSize: selected ? [38, 38] : [32, 32],
    iconAnchor: selected ? [19, 19] : [16, 16],
  });
}

function iconForCenterMarker(marker: EvacuationCenterMapMarker) {
  const statusMeta = EVACUATION_STATUS_META[marker.status];

  return L.divIcon({
    className: "floodwatch-marker-shell",
    html: `<div class="floodwatch-marker" style="--marker-color:${statusMeta.markerColor};--marker-ring:${statusMeta.markerRing}">E</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

type MapZoomControlsProps = {
  satelliteMode: boolean;
  onToggleSatellite: () => void;
};

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
}: FloodMapClientProps) {
  const [satelliteMode, setSatelliteMode] = useState(false);
  const centerMarkerRefs = useRef<Record<string, CenterMarkerInstance | null>>({});
  const reportMarkerRefs = useRef<Record<string, ReportMarkerInstance | null>>({});
  const tileConfig = satelliteMode ? SATELLITE_TILES : STREET_TILES;

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

      panToReportWithOffset(targetMarker, { reason: "external" });
    };

    frameId = window.requestAnimationFrame(focusTargetMarker);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [focusedReportId, reportMarkers]);

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        zoomControl={false}
        attributionControl
        className={cn(
          "floodwatch-leaflet h-full w-full",
          satelliteMode && "is-satellite",
        )}
      >
        <TileLayer attribution={tileConfig.attribution} url={tileConfig.url} />

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

        <MarkerClusterGroup
          chunkedLoading
          maxClusterRadius={56}
          showCoverageOnHover={false}
          spiderfyOnMaxZoom
        >
          {reportMarkers.map((marker) => {
            const statusPresentation = getStatusPresentation(marker.report.status);
            const freshnessBadge = getReportFreshnessBadge(marker.report);
            const activityLabel = getReportActivityLabel(marker.report);
            const isSelected = selectedReportId === marker.reportId;
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
              <Marker
                key={marker.id}
                position={marker.coordinates}
                icon={iconForReportMarker(marker, isSelected)}
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
                    panToReportWithOffset(targetMarker, { reason: "marker-click" });
                  },
                }}
              >
                <Popup>
                  <div className="w-[276px] space-y-2.5">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                      <div className="min-w-0">
                        {isSelected ? (
                          <div className="mb-1 inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[0.62rem] font-semibold text-blue-700">
                            Selected
                          </div>
                        ) : null}
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
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full",
                            statusPresentation.dotClassName,
                          )}
                        />
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
                </Popup>
              </Marker>
            );
          })}
        </MarkerClusterGroup>

        {evacuationCenterMarkers.map((marker) => (
          <Marker
            key={marker.id}
            position={marker.coordinates}
            icon={iconForCenterMarker(marker)}
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

                const targetLatLng = targetMarker.getLatLng();
                targetMarker.openPopup();
                targetMarker._map?.flyTo(targetLatLng, 13, { duration: 0.9 });
              },
            }}
          >
            {(() => {
              const facilitySummary = summarizeEvacuationFacilities(marker.center.facilities, 3);

              return (
                <Popup>
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
                </Popup>
              );
            })()}
          </Marker>
        ))}

        <MapZoomControls
          satelliteMode={satelliteMode}
          onToggleSatellite={() => setSatelliteMode((current) => !current)}
        />
      </MapContainer>
    </div>
  );
}
