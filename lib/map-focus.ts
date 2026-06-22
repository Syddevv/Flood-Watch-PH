type LeafletLatLng = { lat: number; lng: number };

export type FocusableLeafletMarker = {
  openPopup: () => void;
  getLatLng: () => LeafletLatLng;
  _map?: {
    flyTo: (
      center: LeafletLatLng,
      zoom: number,
      options?: Record<string, unknown>,
    ) => void;
    panBy?: (
      offset: [number, number],
      options?: Record<string, unknown>,
    ) => void;
  };
};

export type ReportMarkerFocusReason = "marker-click" | "external";

export function getReportMarkerPanOffset(reason: ReportMarkerFocusReason = "external") {
  if (typeof window === "undefined") {
    return [0, 92] as [number, number];
  }

  if (window.innerWidth < 768) {
    return [0, reason === "marker-click" ? 116 : 154] as [number, number];
  }

  return [-112, reason === "marker-click" ? 70 : 92] as [number, number];
}

export function panToReportWithOffset(
  marker: FocusableLeafletMarker,
  options: {
    zoom?: number;
    reason?: ReportMarkerFocusReason;
    flyDuration?: number;
    panDelayMs?: number;
  } = {},
) {
  const latLng = marker.getLatLng();
  const zoom = options.zoom ?? 13;
  const reason = options.reason ?? "external";

  marker.openPopup();
  marker._map?.flyTo(latLng, zoom, {
    duration: options.flyDuration ?? (reason === "marker-click" ? 0.9 : 0.95),
  });

  if (typeof window === "undefined") {
    return;
  }

  window.setTimeout(() => {
    marker.openPopup();
    marker._map?.panBy?.(getReportMarkerPanOffset(reason), {
      animate: true,
      duration: 0.35,
    });
  }, options.panDelayMs ?? 220);
}
