import assert from "node:assert/strict";
import test from "node:test";

import { calculateDistanceMeters, createBoundingBox } from "@/lib/report-geo";

test("distance is zero for identical coordinates", () => {
  const point = { latitude: 14.5995, longitude: 120.9842 };
  assert.equal(calculateDistanceMeters(point, point), 0);
});

test("distance calculation is symmetric and geographically reasonable", () => {
  const manila = { latitude: 14.5995, longitude: 120.9842 };
  const quezonCity = { latitude: 14.676, longitude: 121.0437 };
  const forward = calculateDistanceMeters(manila, quezonCity);
  const reverse = calculateDistanceMeters(quezonCity, manila);

  assert.ok(Math.abs(forward - reverse) < 0.001);
  assert.ok(forward > 10_000 && forward < 12_000);
});

test("bounding box contains points at the requested radius", () => {
  const center = { latitude: 14.5995, longitude: 120.9842 };
  const radiusMeters = 1_000;
  const box = createBoundingBox(center.latitude, center.longitude, radiusMeters);

  assert.ok(box.minLatitude < center.latitude);
  assert.ok(box.maxLatitude > center.latitude);
  assert.ok(box.minLongitude < center.longitude);
  assert.ok(box.maxLongitude > center.longitude);

  const northEdgeDistance = calculateDistanceMeters(center, {
    latitude: box.maxLatitude,
    longitude: center.longitude,
  });
  assert.ok(northEdgeDistance > 990 && northEdgeDistance < 1_010);
});
