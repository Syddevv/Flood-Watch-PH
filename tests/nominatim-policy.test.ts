import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Nominatim access uses a shared cache and one-request-per-second queue", async () => {
  const implementation = await readFile("lib/nominatim.ts", "utf8");
  const reportLocation = await readFile("lib/report-location.ts", "utf8");
  const weather = await readFile("lib/weather.ts", "utf8");

  assert.match(implementation, /NOMINATIM_MIN_INTERVAL_MS = 1000/);
  assert.match(implementation, /nominatimQueue/);
  assert.match(implementation, /unstable_cache/);
  assert.match(implementation, /NOMINATIM_CACHE_TTL_SECONDS/);
  assert.match(reportLocation, /fetchNominatimReverse/);
  assert.doesNotMatch(reportLocation, /nominatim\.openstreetmap\.org/);
  assert.match(weather, /fetchNominatimReverse/);
  assert.doesNotMatch(weather, /nominatim\.openstreetmap\.org/);
});
