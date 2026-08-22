import assert from "node:assert/strict";
import test from "node:test";

import { fetchWeatherLocation } from "@/lib/weather-client";

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

test("logs a warning when the coordinates lookup is rate limited (429), and still throws as before", async (t) => {
  const warnCalls: unknown[][] = [];
  t.mock.method(console, "warn", (...args: unknown[]) => {
    warnCalls.push(args);
  });
  t.mock.method(globalThis, "fetch", async (input: string | URL) => {
    assert.match(String(input), /\/api\/weather\/coordinates/);
    return jsonResponse({ error: "Too many requests. Please try again later." }, 429, {
      "Retry-After": "12",
    });
  });

  await assert.rejects(
    () => fetchWeatherLocation({ lat: 14.65, lon: 121.1 }),
    /Too many requests/,
  );

  assert.equal(warnCalls.length, 1);
  assert.match(String(warnCalls[0][0]), /429/);
  assert.match(String(warnCalls[0][0]), /coordinates/);
  assert.match(String(warnCalls[0][0]), /12/);
});
