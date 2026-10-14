import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { BULACAN_LOCALITIES } from "@/data/bulacan-localities";
import boundary from "@/data/bulacan-boundary.json";
import rawSource from "@/data/sources/bulacan-osm-nominatim-2026-10-14.json";
import localityPoints from "@/tests/fixtures/bulacan-locality-points.json";
import { BULACAN_BOUNDS, isPointInScopeGeometry, isWithinBulacan, parseScopeGeometry } from "@/lib/bulacan-scope";

test("sourced Bulacan boundary and PSA locality vocabulary", () => {
  assert.equal(readFileSync("data/bulacan-boundary.geojson", "utf8"), readFileSync("data/bulacan-boundary.json", "utf8"));
  assert.equal(boundary.properties.osmRelationId, 1504656);
  assert.deepEqual(boundary.geometry, rawSource.geojson);
  assert.ok(parseScopeGeometry(boundary).length > 0);
  assert.equal(BULACAN_LOCALITIES.length, 24);
  assert.equal(new Set(BULACAN_LOCALITIES.map(({ code }) => code)).size, 24);
  assert.equal(localityPoints.points.length, BULACAN_LOCALITIES.length);
  for (const locality of BULACAN_LOCALITIES) {
    const point = localityPoints.points.find(({ code }) => code === locality.code);
    assert.ok(point, `missing locality point: ${locality.name}`);
    assert.equal(isWithinBulacan(point.latitude, point.longitude), true, locality.name);
  }
  assert.equal(isWithinBulacan(14.91517, 120.76621), true);
  assert.equal(isWithinBulacan(14.5995, 120.9842), false);
  assert.equal(isWithinBulacan(BULACAN_BOUNDS[0][0], BULACAN_BOUNDS[0][1]), false);
});

test("Polygon and MultiPolygon use GeoJSON longitude-latitude order, including islands and holes", () => {
  const outer = [[120, 14], [122, 14], [122, 16], [120, 16], [120, 14]];
  const hole = [[120.5, 14.5], [121.5, 14.5], [121.5, 15.5], [120.5, 15.5], [120.5, 14.5]];
  const island = [[123, 14], [124, 14], [124, 15], [123, 15], [123, 14]];
  const shape = { type: "MultiPolygon", coordinates: [[outer, hole], [island]] };
  assert.equal(isPointInScopeGeometry(14.25, 120.25, shape), true);
  assert.equal(isPointInScopeGeometry(14.75, 120.75, shape), false);
  assert.equal(isPointInScopeGeometry(14.5, 121, shape), false); // hole edge
  assert.equal(isPointInScopeGeometry(14, 120, shape), true); // outer vertex
  assert.equal(isPointInScopeGeometry(14, 121, shape), true); // outer edge
  assert.equal(isPointInScopeGeometry(14.5, 123.5, shape), true); // island
  assert.equal(isPointInScopeGeometry(13, 121, shape), false);
  assert.equal(isPointInScopeGeometry(Number.NaN, 121, shape), false);
  assert.equal(isPointInScopeGeometry(95, 121, shape), false);
  assert.throws(() => parseScopeGeometry({ type: "Polygon", coordinates: [[[120, 14], [121, 14], [121, 15]]] }));
});
