import assert from "node:assert/strict";
import test from "node:test";

import { searchLocation } from "@/lib/location-client";

test("location search uses the geocoding-only endpoint", async (t) => {
  t.mock.method(globalThis, "fetch", async (input: string | URL) => {
    assert.match(String(input), /\/api\/location\/search\?query=Cutcot/);
    return new Response(
      JSON.stringify({
        data: { name: "Cutcot, Pulilan, Bulacan", latitude: 14.90167, longitude: 120.84917 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  });

  assert.deepEqual(await searchLocation("Cutcot"), {
    name: "Cutcot, Pulilan, Bulacan",
    latitude: 14.90167,
    longitude: 120.84917,
  });
});
