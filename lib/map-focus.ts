type LeafletLatLng = { lat: number; lng: number };
type LeafletPoint = { x: number; y: number };

export type FocusableLeafletMap = {
  flyTo: (
    center: LeafletLatLng,
    zoom: number,
    options?: Record<string, unknown>,
  ) => void;
  project: (latLng: LeafletLatLng, zoom: number) => LeafletPoint;
  unproject: (point: LeafletPoint, zoom: number) => LeafletLatLng;
  getZoom?: () => number;
};

export type FocusableLeafletMarker = {
  openPopup: () => void;
  getLatLng: () => LeafletLatLng;
  _map?: FocusableLeafletMap;
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

/**
 * The map center that puts `latLng` at `offset` pixels from the viewport
 * center at `zoom` - i.e. the same view that `setView(latLng, zoom)` followed
 * by `panBy(offset)` would produce, but expressed as a single target.
 *
 * Folding the offset into the fly-to target matters: running an animated
 * `panBy` while a `flyTo` is still in flight makes Leaflet's canvas renderer
 * (the boundary/mask overlays) drift out of alignment with the tiles until the
 * next redraw. One animation, one destination, no drift.
 */
export function getOffsetTargetCenter(
  map: Pick<FocusableLeafletMap, "project" | "unproject">,
  latLng: LeafletLatLng,
  zoom: number,
  offset: [number, number],
): LeafletLatLng {
  const projected = map.project(latLng, zoom);
  return map.unproject({ x: projected.x + offset[0], y: projected.y + offset[1] }, zoom);
}

/**
 * The zoom to focus a report at: the preferred zoom, or the user's current
 * zoom when they are already closer in.
 *
 * Never zooming out is the point. Report pins can sit tens of metres apart,
 * which is inside `maxClusterRadius` at the preferred zoom, so flying out to a
 * fixed zoom hands the clicked marker back to leaflet.markercluster. The
 * cluster then detaches the marker from the map and its popup closes on its
 * own about a second after opening - right after the user drilled in to
 * separate those pins in the first place.
 */
export function getReportFocusZoom(
  currentZoom: number | undefined,
  preferredZoom: number,
): number {
  if (typeof currentZoom !== "number" || !Number.isFinite(currentZoom)) {
    return preferredZoom;
  }

  return Math.max(currentZoom, preferredZoom);
}

export function flyToWithOffset(
  map: FocusableLeafletMap,
  latLng: LeafletLatLng,
  zoom: number,
  offset: [number, number],
  duration: number,
) {
  map.flyTo(getOffsetTargetCenter(map, latLng, zoom, offset), zoom, { duration });
}

export function panToReportWithOffset(
  marker: FocusableLeafletMarker,
  options: {
    zoom?: number;
    reason?: ReportMarkerFocusReason;
    flyDuration?: number;
    popupReopenDelayMs?: number;
  } = {},
) {
  const latLng = marker.getLatLng();
  const preferredZoom = options.zoom ?? 13;
  const reason = options.reason ?? "external";

  marker.openPopup();

  if (marker._map) {
    flyToWithOffset(
      marker._map,
      latLng,
      getReportFocusZoom(marker._map.getZoom?.(), preferredZoom),
      getReportMarkerPanOffset(reason),
      options.flyDuration ?? (reason === "marker-click" ? 0.9 : 0.95),
    );
  }

  if (typeof window === "undefined") {
    return;
  }

  // Re-assert the popup once the flight is underway (clusters can re-render
  // the marker during zoom). This does not move the map.
  window.setTimeout(() => {
    marker.openPopup();
  }, options.popupReopenDelayMs ?? 220);
}
