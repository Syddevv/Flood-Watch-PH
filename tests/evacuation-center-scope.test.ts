import assert from "node:assert/strict";
import test from "node:test";
import { EVACUATION_CENTERS } from "@/data/evacuation-centers";
import { isWithinBulacan } from "@/lib/bulacan-scope";
import { NEARBY_EVACUATION_CENTERS, NEARBY_EVACUATION_CENTER_IDS, NEARBY_EVACUATION_FEATURED_CENTERS, getEvacuationCenterDistanceKm, selectNearbyEvacuationCenters } from "@/lib/evacuation-center-scope";

test("all and only in-province static references are available to public map and list", () => {
  const expected = EVACUATION_CENTERS.filter((center) => isWithinBulacan(center.latitude, center.longitude));
  assert.equal(NEARBY_EVACUATION_CENTERS.length, expected.length);
  assert.deepEqual(new Set(NEARBY_EVACUATION_CENTERS.map(({ id }) => id)), new Set(expected.map(({ id }) => id)));
  assert.deepEqual(NEARBY_EVACUATION_CENTER_IDS, new Set(expected.map(({ id }) => id)));
  assert.ok(NEARBY_EVACUATION_CENTERS.some(({ city }) => city === "Santa Maria"));
});

test("distance only orders in-province references, with optional explicit radius filtering", () => {
  const distances = NEARBY_EVACUATION_CENTERS.map(getEvacuationCenterDistanceKm);
  assert.ok(distances.every((distance, index) => index === 0 || distance >= distances[index - 1]));
  assert.ok(selectNearbyEvacuationCenters(EVACUATION_CENTERS, 10).length < NEARBY_EVACUATION_CENTERS.length);
  assert.deepEqual(NEARBY_EVACUATION_FEATURED_CENTERS, NEARBY_EVACUATION_CENTERS.slice(0, 4));
});

test("static references retain their unverified state", () => {
  assert.ok(NEARBY_EVACUATION_CENTERS.every(({ verificationStatus }) => verificationStatus === "needs_verification"));
});
