import assert from "node:assert/strict";
import test from "node:test";

import {
  CALUMPIT_BOUNDS,
  CALUMPIT_CENTER,
  CALUMPIT_MAP_MAX_BOUNDS,
  CALUMPIT_POLYGON,
  isWithinCalumpit,
  isWithinCalumpitMapBounds,
} from "@/lib/calumpit-boundary";
import { EVACUATION_CENTERS } from "@/data/evacuation-centers";

test("the polygon is a real ring stored in [lat, lng] order", () => {
  assert.ok(CALUMPIT_POLYGON.length > 100);
  for (const [lat, lng] of CALUMPIT_POLYGON) {
    assert.ok(lat > 14.8 && lat < 15.0, `lat ${lat} out of Calumpit range`);
    assert.ok(lng > 120.7 && lng < 120.9, `lng ${lng} out of Calumpit range`);
  }
});

test("the centroid and the Calumpit municipal gymnasium are inside", () => {
  assert.equal(isWithinCalumpit(CALUMPIT_CENTER[0], CALUMPIT_CENTER[1]), true);
  assert.equal(isWithinCalumpit(14.9169, 120.7657), true);
});

test("the relocated seed report coordinates are inside", () => {
  assert.equal(isWithinCalumpit(14.916, 120.766), true);
  assert.equal(isWithinCalumpit(14.908, 120.758), true);
  assert.equal(isWithinCalumpit(14.905, 120.78), true);
});

test("Metro Manila and the old seed coordinates are outside", () => {
  assert.equal(isWithinCalumpit(14.5995, 120.9842), false);
  assert.equal(isWithinCalumpit(14.6407, 121.1029), false);
  assert.equal(isWithinCalumpit(14.5869, 121.1038), false);
  assert.equal(isWithinCalumpit(14.7004, 121.0744), false);
});

test("a point inside the bounding box but outside the polygon is rejected", () => {
  // Bounding-box corners belong to neighbouring municipalities, so at least
  // one corner must be outside the polygon. This proves the check is a real
  // point-in-polygon test rather than a bounding-box test.
  const [[minLat, minLng], [maxLat, maxLng]] = CALUMPIT_BOUNDS;
  const corners: Array<[number, number]> = [
    [minLat, minLng],
    [minLat, maxLng],
    [maxLat, minLng],
    [maxLat, maxLng],
  ];
  const outsideCorner = corners.find(([lat, lng]) => !isWithinCalumpit(lat, lng));
  assert.ok(outsideCorner, "expected at least one bbox corner to fall outside the polygon");
});

test("non-finite coordinates are never inside", () => {
  assert.equal(isWithinCalumpit(Number.NaN, 120.766), false);
  assert.equal(isWithinCalumpit(14.916, Number.POSITIVE_INFINITY), false);
});

test("the padded map bounds keep neighbouring-town evacuation centers reachable", () => {
  const nearbyIds = [
    "calumpit-municipal-gymnasium-reference",
    "hagonoy-sports-complex-reference",
    "malolos-sports-and-convention-center",
    "pulilan-municipal-gymnasium-reference",
    "plaridel-municipal-gymnasium-reference",
    "guiguinto-athletic-and-cultural-center-reference",
    "balagtas-sports-complex-reference",
    "bocaue-municipal-gymnasium-reference",
  ];

  for (const id of nearbyIds) {
    const center = EVACUATION_CENTERS.find((entry) => entry.id === id);
    assert.ok(center, `missing evacuation center fixture ${id}`);
    assert.equal(
      isWithinCalumpitMapBounds(center.latitude, center.longitude),
      true,
      `${id} should be inside the padded map bounds`,
    );
  }

  const marikina = EVACUATION_CENTERS.find((entry) => entry.id === "marikina-sports-complex");
  assert.ok(marikina);
  assert.equal(isWithinCalumpitMapBounds(marikina.latitude, marikina.longitude), false);
});

test("the padded map bounds fully contain the tight Calumpit bounds", () => {
  const [[minLat, minLng], [maxLat, maxLng]] = CALUMPIT_BOUNDS;
  const [[padMinLat, padMinLng], [padMaxLat, padMaxLng]] = CALUMPIT_MAP_MAX_BOUNDS;
  assert.ok(padMinLat < minLat && padMinLng < minLng);
  assert.ok(padMaxLat > maxLat && padMaxLng > maxLng);
});
