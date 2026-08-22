import assert from "node:assert/strict";
import test from "node:test";

import { weatherProviderErrorResponse } from "@/lib/weather-api";

test("weather provider failures return a stable generic response", async () => {
  const response = weatherProviderErrorResponse();

  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await response.json(), {
    error:
      "Weather data is temporarily unavailable. Please check PAGASA or try again later.",
  });
});
