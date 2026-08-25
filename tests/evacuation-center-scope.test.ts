import assert from "node:assert/strict";
import test from "node:test";

import { EVACUATION_CENTERS } from "@/data/evacuation-centers";
import { isWithinCalumpitMapBounds } from "@/lib/calumpit-boundary";
import {
  DEFAULT_EVACUATION_CENTER_NEARBY_RADIUS_KM,
  NEARBY_EVACUATION_CENTERS,
  NEARBY_EVACUATION_CENTER_IDS,
  NEARBY_EVACUATION_FEATURED_CENTERS,
  getEvacuationCenterDistanceKm,
  isNearbyEvacuationCenter,
  resolveEvacuationCenterNearbyRadiusKm,
  selectNearbyEvacuationCenters,
} from "@/lib/evacuation-center-scope";

const EXPECTED_NEARBY_IDS = [
  "calumpit-municipal-gymnasium-reference",
  "malolos-sports-and-convention-center",
  "pulilan-municipal-gymnasium-reference",
  "hagonoy-sports-complex-reference",
  "plaridel-municipal-gymnasium-reference",
  "guiguinto-athletic-and-cultural-center-reference",
  "balagtas-sports-complex-reference",
  "bocaue-municipal-gymnasium-reference",
];

function findCenter(id: string) {
  const center = EVACUATION_CENTERS.find((entry) => entry.id === id);
  assert.ok(center, `missing evacuation center fixture ${id}`);
  return center;
}

test("the nearby set is exactly the eight reachable Bulacan centers, nearest first", () => {
  assert.deepEqual(
    NEARBY_EVACUATION_CENTERS.map((center) => center.id),
    EXPECTED_NEARBY_IDS,
  );
  assert.equal(NEARBY_EVACUATION_CENTERS[0].id, "calumpit-municipal-gymnasium-reference");
  assert.deepEqual([...NEARBY_EVACUATION_CENTER_IDS].sort(), [...EXPECTED_NEARBY_IDS].sort());
});

test("the nearby set is sorted by ascending distance from Calumpit", () => {
  const distances = NEARBY_EVACUATION_CENTERS.map(getEvacuationCenterDistanceKm);
  for (let i = 1; i < distances.length; i += 1) {
    assert.ok(distances[i] >= distances[i - 1], `not sorted at index ${i}`);
  }
});

test("far Bulacan towns and every Metro Manila / Rizal center are excluded", () => {
  for (const id of [
    "marilao-municipal-gymnasium-reference",
    "meycauayan-city-sports-complex-reference",
    "obando-sports-complex-reference",
    "san-jose-del-monte-sports-complex",
  ]) {
    assert.equal(NEARBY_EVACUATION_CENTER_IDS.has(id), false, `${id} should be excluded`);
  }

  for (const center of EVACUATION_CENTERS) {
    if (center.province === "Metro Manila" || center.province === "Rizal") {
      assert.equal(NEARBY_EVACUATION_CENTER_IDS.has(center.id), false, `${center.id} should be excluded`);
    }
  }
});

test("every nearby center is reachable on the locked map (inside the padded box)", () => {
  for (const center of NEARBY_EVACUATION_CENTERS) {
    assert.equal(
      isWithinCalumpitMapBounds(center.latitude, center.longitude),
      true,
      `${center.id} is nearby but outside the map's max bounds`,
    );
  }
});

test("Santa Maria is inside the radius but clipped by the map box, so it is not nearby", () => {
  const santaMaria = findCenter("santa-maria-municipal-covered-court-reference");
  assert.ok(getEvacuationCenterDistanceKm(santaMaria) < DEFAULT_EVACUATION_CENTER_NEARBY_RADIUS_KM);
  assert.equal(isWithinCalumpitMapBounds(santaMaria.latitude, santaMaria.longitude), false);
  assert.equal(isNearbyEvacuationCenter(santaMaria), false);
});

test("the radius env override is parsed, defaulted, and clamped", () => {
  assert.equal(resolveEvacuationCenterNearbyRadiusKm(undefined), 25);
  assert.equal(resolveEvacuationCenterNearbyRadiusKm("abc"), 25);
  assert.equal(resolveEvacuationCenterNearbyRadiusKm("-5"), 25);
  assert.equal(resolveEvacuationCenterNearbyRadiusKm("10"), 10);
  assert.equal(resolveEvacuationCenterNearbyRadiusKm("999"), 100);
});

test("a tighter radius narrows the selection predictably", () => {
  assert.deepEqual(
    selectNearbyEvacuationCenters(EVACUATION_CENTERS, 10).map((center) => center.id),
    [
      "calumpit-municipal-gymnasium-reference",
      "malolos-sports-and-convention-center",
      "pulilan-municipal-gymnasium-reference",
    ],
  );
});

test("featured centers are the four nearest and all nearby", () => {
  assert.equal(NEARBY_EVACUATION_FEATURED_CENTERS.length, 4);
  assert.deepEqual(
    NEARBY_EVACUATION_FEATURED_CENTERS.map((center) => center.id),
    EXPECTED_NEARBY_IDS.slice(0, 4),
  );
});

// Every reference center is still unverified community data. When the first
// LGU/DSWD-verified record lands, UPDATE this test to assert the verified
// entry is presented as verified - do not delete it.
test("no nearby center is presented as verified (all are needs_verification reference data)", () => {
  for (const center of NEARBY_EVACUATION_CENTERS) {
    assert.equal(center.verificationStatus, "needs_verification", center.id);
    assert.equal(center.lastVerifiedAt, undefined, center.id);
  }
});
