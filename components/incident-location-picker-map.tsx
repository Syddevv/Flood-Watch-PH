"use client";

import "leaflet/dist/leaflet.css";

import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";

const DEFAULT_CENTER: [number, number] = [14.6176, 121.0325];
const DEFAULT_ZOOM = 11;
const PHILIPPINES_BOUNDS: [[number, number], [number, number]] = [
  [4.2, 116.0],
  [21.8, 127.3],
];

const pickerMarkerIcon = L.divIcon({
  className: "floodwatch-marker-shell",
  html: '<div class="floodwatch-marker" style="--marker-color:var(--color-primary);--marker-ring:color-mix(in_srgb,var(--color-primary)_22%,transparent);--marker-border:color-mix(in_srgb,var(--color-primary)_65%,white)">P</div>',
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
    on: (event: string, handler: (event: { latlng: { lat: number; lng: number } }) => void) => void;
    off: (event: string, handler: (event: { latlng: { lat: number; lng: number } }) => void) => void;
  };

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
  onSelect,
}: IncidentLocationPickerMapProps) {
  const center = selectedCoordinates
    ? ([selectedCoordinates.latitude, selectedCoordinates.longitude] as [number, number])
    : DEFAULT_CENTER;

  return (
    <MapContainer
      center={center}
      zoom={selectedCoordinates ? 14 : DEFAULT_ZOOM}
      minZoom={6}
      maxBounds={PHILIPPINES_BOUNDS}
      maxBoundsViscosity={0.9}
      zoomControl
      attributionControl
      className="floodwatch-leaflet h-full w-full"
    >
      <TileLayer
        attribution="&copy; OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <PickerMapEvents
        selectedCoordinates={selectedCoordinates}
        focusCoordinates={focusCoordinates}
        onSelect={onSelect}
      />

      {selectedCoordinates ? (
        <Marker
          position={[selectedCoordinates.latitude, selectedCoordinates.longitude]}
          icon={pickerMarkerIcon}
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
