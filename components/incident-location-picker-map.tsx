"use client";

import "leaflet/dist/leaflet.css";

import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polygon, TileLayer, useMap } from "react-leaflet";

import {
  CALUMPIT_BOUNDS,
  CALUMPIT_CENTER,
  CALUMPIT_MAP_MAX_BOUNDS,
  CALUMPIT_POLYGON,
} from "@/lib/calumpit-boundary";

const DEFAULT_CENTER: [number, number] = CALUMPIT_CENTER;
const DEFAULT_ZOOM = 13;
const BOUNDARY_COLOR = "#2563eb";

const pickerMarkerIcon = L.divIcon({
  className: "floodwatch-marker-shell",
  html: '<div class="floodwatch-marker" style="--marker-color:var(--color-primary);--marker-ring:color-mix(in_srgb,var(--color-primary)_22%,transparent);--marker-border:color-mix(in_srgb,var(--color-primary)_65%,white)">P</div>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

const pickerMarkerIconOutside = L.divIcon({
  className: "floodwatch-marker-shell",
  html: '<div class="floodwatch-marker" style="--marker-color:var(--color-danger);--marker-ring:color-mix(in_srgb,var(--color-danger)_22%,transparent);--marker-border:color-mix(in_srgb,var(--color-danger)_65%,white)">!</div>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

type Coordinates = {
  latitude: number;
  longitude: number;
};

type IncidentLocationPickerMapProps = {
  selectedCoordinates: Coordinates | null;
  focusCoordinates: Coordinates | null;
  selectionOutsideArea?: boolean;
  onSelect: (latitude: number, longitude: number) => void;
};

function PickerMapEvents({
  selectedCoordinates,
  focusCoordinates,
  onSelect,
}: IncidentLocationPickerMapProps) {
  const map = useMap();
  const interactiveMap = map as unknown as {
    flyTo: (
      center: [number, number],
      zoom: number,
      options?: Record<string, unknown>,
    ) => void;
    invalidateSize: (options?: Record<string, unknown>) => void;
    on: (event: string, handler: (event: { latlng: { lat: number; lng: number } }) => void) => void;
    off: (event: string, handler: (event: { latlng: { lat: number; lng: number } }) => void) => void;
  };

  useEffect(() => {
    const invalidateMapSize = () => {
      window.requestAnimationFrame(() => {
        interactiveMap.invalidateSize({ pan: false });
      });
    };
    const timeoutId = window.setTimeout(invalidateMapSize, 120);

    invalidateMapSize();
    window.addEventListener("resize", invalidateMapSize);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("resize", invalidateMapSize);
    };
  }, [interactiveMap]);

  useEffect(() => {
    const target = focusCoordinates ?? selectedCoordinates;
    if (!target) {
      return;
    }

    interactiveMap.flyTo([target.latitude, target.longitude], 14, {
      duration: 0.7,
    });
  }, [focusCoordinates, interactiveMap, selectedCoordinates]);

  useEffect(() => {
    const handleClick = (event: { latlng: { lat: number; lng: number } }) => {
      onSelect(event.latlng.lat, event.latlng.lng);
    };

    interactiveMap.on("click", handleClick);
    return () => {
      interactiveMap.off("click", handleClick);
    };
  }, [interactiveMap, onSelect]);

  return null;
}

export function IncidentLocationPickerMap({
  selectedCoordinates,
  focusCoordinates,
  selectionOutsideArea = false,
  onSelect,
}: IncidentLocationPickerMapProps) {
  const center = selectedCoordinates
    ? ([selectedCoordinates.latitude, selectedCoordinates.longitude] as [number, number])
    : DEFAULT_CENTER;

  return (
    <MapContainer
      center={center}
      zoom={selectedCoordinates ? 14 : DEFAULT_ZOOM}
      bounds={selectedCoordinates ? undefined : CALUMPIT_BOUNDS}
      minZoom={11}
      maxBounds={CALUMPIT_MAP_MAX_BOUNDS}
      maxBoundsViscosity={1}
      zoomControl
      attributionControl
      className="floodwatch-leaflet h-full w-full"
    >
      <TileLayer
        attribution="&copy; OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <Polygon
        positions={CALUMPIT_POLYGON as [number, number][]}
        interactive={false}
        pathOptions={{
          color: BOUNDARY_COLOR,
          weight: 2,
          opacity: 0.9,
          dashArray: "6 6",
          fillColor: BOUNDARY_COLOR,
          fillOpacity: 0.04,
        }}
      />

      <PickerMapEvents
        selectedCoordinates={selectedCoordinates}
        focusCoordinates={focusCoordinates}
        onSelect={onSelect}
      />

      {selectedCoordinates ? (
        <Marker
          position={[selectedCoordinates.latitude, selectedCoordinates.longitude]}
          icon={selectionOutsideArea ? pickerMarkerIconOutside : pickerMarkerIcon}
          draggable
          eventHandlers={{
            dragend: (event: {
              target: { getLatLng: () => { lat: number; lng: number } };
            }) => {
              const nextPosition = event.target.getLatLng();
              onSelect(nextPosition.lat, nextPosition.lng);
            },
          }}
        />
      ) : null}
    </MapContainer>
  );
}
