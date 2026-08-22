import assert from "node:assert/strict";
import test from "node:test";

import { resolveReportLocationName } from "@/lib/report-location-client";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("returns the precise report address when the primary lookup succeeds", async (t) => {
  t.mock.method(globalThis, "fetch", async (input: string | URL) => {
    const url = String(input);
    assert.match(url, /\/api\/reports\/reverse-geocode/);
    return jsonResponse({
      data: { locationName: "Marikina", formattedAddress: "Marcos Highway, Marikina, Metro Manila" },
    });
  });

  const result = await resolveReportLocationName(14.65, 121.1);

  assert.deepEqual(result, {
    locationName: "Marcos Highway, Marikina, Metro Manila",
    precise: true,
  });
});

test("falls back to the approximate weather-domain lookup when the primary lookup fails", async (t) => {
  t.mock.method(globalThis, "fetch", async (input: string | URL) => {
    const url = String(input);

    if (url.includes("/api/reports/reverse-geocode")) {
      return jsonResponse({ error: "Reverse-geocoding failed." }, 502);
    }

    assert.match(url, /\/api\/weather\/coordinates/);
    return jsonResponse({
      data: {
        location: { name: "Marikina" },
        fetchedAt: "now",
        advisoryMessage: "",
        resolvedAddress: "Marikina, Metro Manila",
      },
    });
  });

  const result = await resolveReportLocationName(14.65, 121.1);

  assert.deepEqual(result, { locationName: "Marikina, Metro Manila", precise: false });
});

test("throws when both the precise and approximate lookups fail", async (t) => {
  t.mock.method(globalThis, "fetch", async (input: string | URL) => {
    const url = String(input);

    if (url.includes("/api/reports/reverse-geocode")) {
      return jsonResponse({ error: "Reverse-geocoding failed." }, 502);
    }

    return jsonResponse({ error: "Unable to load weather for this location." }, 502);
  });

  await assert.rejects(() => resolveReportLocationName(14.65, 121.1));
});
