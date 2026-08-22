import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// `app/api/weather/coordinates/route.ts` imports `lib/request-security.ts`,
// which imports the `server-only` package. That package only resolves
// inside Next.js's own bundler/dev-server - a plain `node:test` process
// (as used by `npm run test`) cannot import it, so this route can't be
// exercised end-to-end here (this is also why no other `app/api/**`
// route.ts file has a direct-invocation test in this suite). Instead, this
// asserts the actual source structure of the caching decision, the same
// approach already used for other route/DB-adjacent logic in
// tests/nominatim-policy.test.ts and tests/rate-limit-cleanup.test.ts.
test("the weather-coordinates route only uses the long-TTL cache when a name is supplied, and returns no-store otherwise", async () => {
  const source = await readFile("app/api/weather/coordinates/route.ts", "utf8");

  // The reverse-geocode (no-name) branch must call getWeatherByCoordinates
  // directly, with the raw (unrounded) coordinates - not the long-TTL,
  // rounded-coordinate cache wrapper.
  assert.match(
    source,
    /:\s*await getWeatherByCoordinates\(latitude, longitude\)/,
    "expected the no-name branch to call getWeatherByCoordinates(latitude, longitude) directly, uncached",
  );

  // The named branch must still go through the rounded-coordinate, long-TTL
  // cache wrapper.
  assert.match(
    source,
    /\?\s*await getCachedWeatherByCoordinates\(\s*roundWeatherCoordinate\(latitude\),\s*roundWeatherCoordinate\(longitude\),\s*name,?\s*\)/,
    "expected the name branch to call getCachedWeatherByCoordinates(roundWeatherCoordinate(latitude), roundWeatherCoordinate(longitude), name)",
  );

  // The ternary must be keyed on `name` for both the data fetch and the
  // response headers, and the no-name branch must be uncached at the CDN
  // layer too.
  assert.match(
    source,
    /const result = name\s*\?/,
    "expected the cache decision to branch on `name`",
  );
  assert.match(
    source,
    /headers: name \? getWeatherCacheHeaders\(\) : \{ "Cache-Control": "no-store" \}/,
    'expected the no-name branch to respond with "Cache-Control": "no-store" instead of the long-TTL cache headers',
  );
});
