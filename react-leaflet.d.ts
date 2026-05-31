declare module "react-leaflet" {
  import { ComponentType } from "react";

  export const MapContainer: ComponentType<Record<string, unknown>>;
  export const Marker: ComponentType<Record<string, unknown>>;
  export const Polygon: ComponentType<Record<string, unknown>>;
  export const TileLayer: ComponentType<Record<string, unknown>>;
  export function useMap(): {
    flyTo: (
      center: [number, number],
      zoom: number,
      options?: Record<string, unknown>,
    ) => void;
    zoomIn: () => void;
    zoomOut: () => void;
  };
}
