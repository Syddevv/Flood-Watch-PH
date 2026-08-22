import assert from "node:assert/strict";
import test from "node:test";

import { buildCoordinateFallbackLabel } from "@/lib/geo-format";

test("uses the default prefix and six decimal places", () => {
  assert.equal(
    buildCoordinateFallbackLabel(14.5995, 120.9842),
    "Location near 14.599500, 120.984200",
  );
});

test("accepts a custom prefix", () => {
  assert.equal(
    buildCoordinateFallbackLabel(14.5995, 120.9842, "Pinned location near"),
    "Pinned location near 14.599500, 120.984200",
  );
});

test("formats negative coordinates", () => {
  assert.equal(
    buildCoordinateFallbackLabel(-8.123456, -74.654321),
    "Location near -8.123456, -74.654321",
  );
});
