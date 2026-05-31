"use client";

import "leaflet/dist/leaflet.css";

import { Crosshair, Layers3, LocateFixed, Satellite } from "lucide-react";
import L from "leaflet";
import { MapContainer, Marker, Polygon, TileLayer, useMap } from "react-leaflet";

import type { LegendItem, MapMarker, RiskPolygon, Theme } from "@/lib/types";
import { cn } from "@/lib/utils";

const DEFAULT_CENTER: [number, number] = [14.6176, 121.0325];
const DEFAULT_ZOOM = 10;

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
      : marker.category === "center"
        ? "#22c55e"
        : "#2563eb";

  const ring =
    marker.category === "hotline" ? "rgba(37,99,235,0.25)" : "rgba(15,23,42,0.22)";

  return L.divIcon({
    className: "floodwatch-marker-shell",
    html: `<div class="floodwatch-marker" style="--marker-color:${color};--marker-ring:${ring}">${marker.label}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function MapZoomControls() {
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
      <button type="button" aria-label="Satellite mode">
        <Satellite className="h-4.5 w-4.5" />
      </button>
    </div>
  );
}

type FloodMapClientProps = {
  theme: Theme;
  markers: MapMarker[];
  polygons: RiskPolygon[];
  legend: LegendItem[];
};

export function FloodMapClient({
  theme,
  markers,
  polygons,
  legend,
}: FloodMapClientProps) {
  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        zoomControl={false}
        attributionControl
        className={cn("floodwatch-leaflet h-full w-full", theme === "dark" && "is-dark")}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

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

        {markers.map((marker) => (
          <Marker
            key={marker.id}
            position={marker.coordinates}
            icon={iconForMarker(marker)}
            title={marker.title}
          />
        ))}

        <MapZoomControls />
      </MapContainer>

      <div className="pointer-events-none absolute inset-0 z-[380] bg-[linear-gradient(to_bottom,rgba(255,255,255,0.06),transparent_18%,transparent_80%,rgba(15,23,42,0.06))]" />

      <div className="pointer-events-auto absolute bottom-4 left-4 z-[450] w-[142px] rounded-[18px] border border-[color:color-mix(in_srgb,var(--color-border)_52%,transparent)] bg-[color:color-mix(in_srgb,var(--color-sidebar)_46%,transparent)] px-3 py-3 shadow-[0_14px_32px_rgba(15,23,42,0.08)] backdrop-blur-md">
        <div className="text-[0.7rem] font-semibold tracking-[0.06em] text-[var(--color-muted-foreground)]">
          FLOOD RISK
        </div>
        <div className="mt-2 space-y-1.25">
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

      <button
        type="button"
        aria-label="Crosshair"
        className="pointer-events-auto absolute bottom-22 right-4 z-[450] flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-sidebar)] text-[var(--color-foreground)] shadow-[var(--shadow-floating)] md:hidden"
      >
        <Crosshair className="h-4.5 w-4.5" />
      </button>
    </div>
  );
}
