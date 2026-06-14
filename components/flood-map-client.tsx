"use client";

import "leaflet/dist/leaflet.css";

import { useState } from "react";
import { Layers3, LocateFixed, Map, Satellite } from "lucide-react";
import L from "leaflet";
import { MapContainer, Marker, Polygon, TileLayer, useMap } from "react-leaflet";

import type {
  LegendItem,
  MapMarker,
  ReportMapMarker,
  RiskPolygon,
  Theme,
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

function iconForMarker(marker: MapMarker) {
  const color =
    marker.category === "alert"
      ? severityColorMap[marker.severity ?? "moderate"]
      : marker.category === "report"
      ? severityColorMap[marker.severity ?? "moderate"]
      : marker.category === "center"
        ? "#22c55e"
        : "#2563eb";

  const ring =
    marker.category === "hotline"
      ? "rgba(37,99,235,0.25)"
      : marker.category === "report"
        ? "rgba(37,99,235,0.18)"
        : "rgba(15,23,42,0.22)";

  return L.divIcon({
    className: "floodwatch-marker-shell",
    html: `<div class="floodwatch-marker" style="--marker-color:${color};--marker-ring:${ring}">${marker.label}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
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
  theme: Theme;
  reportMarkers: ReportMapMarker[];
  polygons: RiskPolygon[];
  legend: LegendItem[];
  onSelectReport: (reportId: string) => void;
};

export function FloodMapClient({
  theme,
  reportMarkers,
  polygons,
  legend,
  onSelectReport,
}: FloodMapClientProps) {
  const [satelliteMode, setSatelliteMode] = useState(false);
  const tileConfig = satelliteMode ? SATELLITE_TILES : STREET_TILES;

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        zoomControl={false}
        attributionControl
        className={cn(
          "floodwatch-leaflet h-full w-full",
          theme === "dark" && !satelliteMode && "is-dark",
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
            icon={iconForMarker(marker)}
            title={marker.title}
            eventHandlers={{
              click: () => onSelectReport(marker.reportId),
            }}
          />
        ))}

        <MapZoomControls
          satelliteMode={satelliteMode}
          onToggleSatellite={() => setSatelliteMode((current) => !current)}
        />
      </MapContainer>

      <div className="pointer-events-none absolute inset-0 z-[380] bg-[linear-gradient(to_bottom,rgba(255,255,255,0.06),transparent_18%,transparent_80%,rgba(15,23,42,0.06))]" />

      <div className="pointer-events-auto absolute bottom-24 left-4 z-[450] w-[196px] rounded-[18px] border border-[color:color-mix(in_srgb,var(--color-border)_52%,transparent)] bg-[color:color-mix(in_srgb,var(--color-sidebar)_46%,transparent)] px-4 py-3 shadow-[0_14px_32px_rgba(15,23,42,0.08)] backdrop-blur-md md:bottom-4">
        <div className="text-[0.7rem] font-semibold tracking-[0.06em] text-[var(--color-muted-foreground)]">
          <div className="text-center">MAP LEGEND MARKER</div>
        </div>
        <div className="mt-2 flex items-center justify-center gap-2 text-[0.8rem] leading-5 text-[var(--color-foreground)]">
          <span className="inline-flex aspect-square h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-[0.72rem] font-bold leading-none text-white shadow-[0_0_0_3px_rgba(37,99,235,0.16)]">
            R
          </span>
          <span className="whitespace-nowrap">Community Report</span>
        </div>
        <div className="mt-3 text-[0.68rem] font-semibold tracking-[0.06em] text-[var(--color-muted-foreground)]">
          SEVERITY
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
      </div>

      <div className="pointer-events-none absolute inset-0 z-[360] bg-[linear-gradient(rgba(255,255,255,0.25)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.25)_1px,transparent_1px)] bg-[size:230px_230px] opacity-[0.22] mix-blend-screen dark:opacity-[0.2]" />
    </div>
  );
}
