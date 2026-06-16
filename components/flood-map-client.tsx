"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp, Clock3, Eye, Layers3, LocateFixed, Map, Satellite, ThumbsUp } from "lucide-react";
import L from "leaflet";
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
} from "@/lib/emergency-resources";
import { formatCountLabel } from "@/lib/reporting";
import {
  getReportCommunitySignal,
  getStatusPresentation,
  severityBadgeClasses,
  severityLabels,
} from "@/lib/report-ui";
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
  safe: "#22c55e",
  moderate: "#f59e0b",
  high: "#f97316",
  severe: "#ef4444",
};

const reportMarkerStatusStyles = {
  "Needs More Confirmation": {
    color: "#f59e0b",
    ring: "rgba(245,158,11,0.18)",
    border: "rgba(245,158,11,0.55)",
    opacity: 1,
  },
  "Confirmed by Community": {
    color: "#ef4444",
    ring: "rgba(239,68,68,0.18)",
    border: "rgba(239,68,68,0.55)",
    opacity: 1,
  },
  "Likely Receded": {
    color: "#64748b",
    ring: "rgba(100,116,139,0.16)",
    border: "rgba(148,163,184,0.48)",
    opacity: 0.72,
  },
  Resolved: {
    color: "#94a3b8",
    ring: "rgba(148,163,184,0.12)",
    border: "rgba(148,163,184,0.4)",
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
  };
};

type ReportMarkerInstance = {
  openPopup: () => void;
  getLatLng: () => { lat: number; lng: number };
  _map?: {
    flyTo: (
      center: { lat: number; lng: number },
      zoom: number,
      options?: Record<string, unknown>,
    ) => void;
  };
};

function iconForReportMarker(marker: ReportMapMarker) {
  const markerStyle = reportMarkerStatusStyles[marker.status];

  return L.divIcon({
    className: "floodwatch-marker-shell",
    html: `<div class="floodwatch-marker" style="--marker-color:${markerStyle.color};--marker-ring:${markerStyle.ring};--marker-border:${markerStyle.border};opacity:${markerStyle.opacity}">R</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
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
      <button type="button" aria-label="Map layers">
        <Layers3 className="h-4.5 w-4.5" />
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
  focusedCenterId?: string | null;
};

export function FloodMapClient({
  reportMarkers,
  evacuationCenterMarkers,
  polygons,
  legend,
  onOpenReportDetails,
  focusedCenterId = null,
}: FloodMapClientProps) {
  const [satelliteMode, setSatelliteMode] = useState(false);
  const [legendOpen, setLegendOpen] = useState(true);
  const centerMarkerRefs = useRef<Record<string, CenterMarkerInstance | null>>({});
  const reportMarkerRefs = useRef<Record<string, ReportMarkerInstance | null>>({});
  const tileConfig = satelliteMode ? SATELLITE_TILES : STREET_TILES;

  useEffect(() => {
    if (!focusedCenterId) {
      return;
    }

    const targetMarker = centerMarkerRefs.current[focusedCenterId];
    if (!targetMarker) {
      return;
    }

    const targetLatLng = targetMarker.getLatLng();
    targetMarker.openPopup();
    targetMarker._map?.flyTo(targetLatLng, 13, { duration: 1.1 });
  }, [focusedCenterId, evacuationCenterMarkers]);

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

        {reportMarkers.map((marker) => (
          <Marker
            key={marker.id}
            position={marker.coordinates}
            icon={iconForReportMarker(marker)}
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

                const targetLatLng = targetMarker.getLatLng();
                targetMarker.openPopup();
                targetMarker._map?.flyTo(targetLatLng, 13, { duration: 0.9 });
              },
            }}
          >
            <Popup>
              <div className="w-[248px] space-y-3">
                <div>
                  <div className="text-[0.98rem] font-semibold text-slate-900">
                    {marker.report.title}
                  </div>
                  <div className="mt-1 text-[0.8rem] text-slate-600">
                    {marker.report.location}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[0.7rem] font-semibold",
                      severityBadgeClasses[marker.report.severity],
                    )}
                  >
                    {severityLabels[marker.report.severity]}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.7rem] font-medium",
                      getStatusPresentation(marker.report.status).textClassName,
                      getStatusPresentation(marker.report.status).wrapperClassName,
                    )}
                  >
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        getStatusPresentation(marker.report.status).dotClassName,
                      )}
                    />
                    <span>{getStatusPresentation(marker.report.status).label}</span>
                  </span>
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
                  <span>{marker.report.lastActivityAgo ?? marker.report.reportedAgo}</span>
                </div>

                <div className="text-[0.75rem] leading-5 text-slate-600">
                  {getReportCommunitySignal(marker.report)}
                </div>

                <button
                  type="button"
                  onClick={() => onOpenReportDetails(marker.reportId)}
                  className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-[10px] bg-[#2563eb] px-3 text-[0.75rem] font-semibold text-white shadow-[0_10px_22px_rgba(37,99,235,0.18)]"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>View Details</span>
                </button>
              </div>
            </Popup>
          </Marker>
        ))}

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
                    {marker.center.status}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {marker.center.facilities.slice(0, 4).map((facility) => (
                    <span
                      key={facility}
                      className="rounded-full bg-slate-100 px-2 py-1 text-[0.68rem] font-medium text-slate-700"
                    >
                      {facility}
                    </span>
                  ))}
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
                    className="inline-flex h-9 items-center justify-center rounded-[10px] bg-[#2563eb] px-3 text-[0.75rem] font-semibold !text-white no-underline shadow-[0_10px_22px_rgba(37,99,235,0.18)]"
                  >
                    Get Directions
                  </a>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        <MapZoomControls
          satelliteMode={satelliteMode}
          onToggleSatellite={() => setSatelliteMode((current) => !current)}
        />
      </MapContainer>

      <div className="pointer-events-none absolute inset-0 z-[380] bg-[linear-gradient(to_bottom,rgba(255,255,255,0.06),transparent_18%,transparent_80%,rgba(15,23,42,0.06))]" />

      <div className="pointer-events-auto absolute bottom-24 left-4 z-[450] w-[216px] rounded-[18px] border border-[color:color-mix(in_srgb,var(--color-border)_52%,transparent)] bg-[color:color-mix(in_srgb,var(--color-sidebar)_46%,transparent)] px-4 py-3 shadow-[0_14px_32px_rgba(15,23,42,0.08)] backdrop-blur-md md:bottom-4">
        <div className="flex items-center justify-between gap-2 text-[0.7rem] font-semibold tracking-[0.06em] text-[var(--color-muted-foreground)]">
          <div>MAP MARKERS</div>
          <button
            type="button"
            aria-label={legendOpen ? "Collapse map markers legend" : "Expand map markers legend"}
            aria-expanded={legendOpen}
            onClick={() => setLegendOpen((current) => !current)}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-[color:color-mix(in_srgb,var(--color-border)_58%,transparent)] bg-[color:color-mix(in_srgb,var(--color-sidebar)_72%,transparent)] text-[var(--color-foreground)]"
          >
            {legendOpen ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
        {legendOpen ? (
          <>
            <div className="mt-2 space-y-2 text-[0.8rem] leading-5 text-[var(--color-foreground)]">
              <div className="flex items-center gap-2">
                <span className="inline-flex aspect-square h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-[0.72rem] font-bold leading-none text-white shadow-[0_0_0_3px_rgba(37,99,235,0.16)]">
                  R
                </span>
                <span>Active Flood Report</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex aspect-square h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#64748b] text-[0.72rem] font-bold leading-none text-white opacity-80 shadow-[0_0_0_3px_rgba(100,116,139,0.16)]">
                  R
                </span>
                <span>Likely Receded Report</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex aspect-square h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#22c55e] text-[0.72rem] font-bold leading-none text-white shadow-[0_0_0_3px_rgba(34,197,94,0.16)]">
                  E
                </span>
                <span>Evacuation Center</span>
              </div>
            </div>
            <div className="mt-3 text-[0.68rem] font-semibold tracking-[0.06em] text-[var(--color-muted-foreground)]">
              RISK OVERLAY SEVERITY
            </div>
            <div className="mt-1 space-y-1.25">
              {legend.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 text-[0.8rem] leading-5 text-[var(--color-foreground)]"
                >
                  <span
                    className="h-2.75 w-2.75 rounded-full"
                    style={{ backgroundColor: severityColorMap[item.severity] }}
                  />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>

      <div className="pointer-events-none absolute inset-0 z-[360] bg-[linear-gradient(rgba(255,255,255,0.25)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.25)_1px,transparent_1px)] bg-[size:230px_230px] opacity-[0.22] mix-blend-screen" />
    </div>
  );
}
