import assert from "node:assert/strict";
import test from "node:test";

import { getOffsetTargetCenter, getReportFocusZoom } from "@/lib/map-focus";

// A fake Leaflet map whose projection is a plain linear scale, so pixel
// offsets translate into predictable lat/lng deltas: 1 px = 0.001 deg.
const PX_PER_DEGREE = 1000;
const fakeMap = {
  project: (latLng: { lat: number; lng: number }) => ({
    x: latLng.lng * PX_PER_DEGREE,
    y: -latLng.lat * PX_PER_DEGREE,
  }),
  unproject: (point: { x: number; y: number }) => ({
    lat: -point.y / PX_PER_DEGREE,
    lng: point.x / PX_PER_DEGREE,
  }),
};

test("an offset of zero returns the marker position itself", () => {
  const center = getOffsetTargetCenter(fakeMap, { lat: 14.9, lng: 120.7 }, 13, [0, 0]);
  assert.equal(center.lat.toFixed(6), "14.900000");
  assert.equal(center.lng.toFixed(6), "120.700000");
});

test("the returned center matches what panBy(offset) would have produced after centering", () => {
  // panBy([dx, dy]) moves the view center by +dx, +dy in projected pixels.
  const center = getOffsetTargetCenter(fakeMap, { lat: 14.9, lng: 120.7 }, 13, [-112, 70]);
  assert.equal(center.lng.toFixed(6), (120.7 - 112 / PX_PER_DEGREE).toFixed(6));
  assert.equal(center.lat.toFixed(6), (14.9 - 70 / PX_PER_DEGREE).toFixed(6));
});

test("projection is evaluated at the target zoom, not the current one", () => {
  const seenZooms: number[] = [];
  const zoomTrackingMap = {
    project: (latLng: { lat: number; lng: number }, zoom: number) => {
      seenZooms.push(zoom);
      return fakeMap.project(latLng);
    },
    unproject: (point: { x: number; y: number }, zoom: number) => {
      seenZooms.push(zoom);
      return fakeMap.unproject(point);
    },
  };

  getOffsetTargetCenter(zoomTrackingMap, { lat: 14.9, lng: 120.7 }, 15, [10, 10]);
  assert.deepEqual(seenZooms, [15, 15]);
});

test("focusing a marker never zooms out from where the user already is", () => {
  // Zooming out on a marker click is what re-clusters nearby pins: the clicked
  // marker gets absorbed into a cluster, Leaflet detaches it from the map, and
  // its popup closes on its own a second after opening.
  assert.equal(getReportFocusZoom(17, 13), 17);
  assert.equal(getReportFocusZoom(16.4, 13), 16.4);
});

test("focusing a marker zooms in when the user is further out", () => {
  assert.equal(getReportFocusZoom(11, 13), 13);
  assert.equal(getReportFocusZoom(13, 13), 13);
});

test("an unknown current zoom falls back to the preferred zoom", () => {
  assert.equal(getReportFocusZoom(Number.NaN, 13), 13);
  assert.equal(getReportFocusZoom(undefined, 13), 13);
});
