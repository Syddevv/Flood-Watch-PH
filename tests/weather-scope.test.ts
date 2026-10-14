import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { MONITORED_WEATHER_POINTS, WEATHER_POINT_SET_VERSION } from "@/data/bulacan-weather-points";
import { BULACAN_LOCALITIES } from "@/data/bulacan-localities";
import { BULACAN_SCOPE_VERSION, isWithinBulacan } from "@/lib/bulacan-scope";
import {
  getWeatherByCoordinates,
  getWeatherOverview,
  OUTSIDE_WEATHER_SCOPE_MESSAGE,
  searchPhilippineLocation,
} from "@/lib/weather";

function forecast(precipitation = 0) {
  return {
    current: {
      time: "2026-10-14T12:00",
      temperature_2m: 28,
      relative_humidity_2m: 80,
      precipitation,
      weather_code: 2,
      wind_speed_10m: 8,
    },
    hourly: { time: ["2026-10-14T12:00"], precipitation: [precipitation] },
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("monitored points use dated U0 locality coordinates inside the versioned polygon", async () => {
  const fixture = JSON.parse(await readFile("tests/fixtures/bulacan-locality-points.json", "utf8")) as {
    points: Array<{ code: string; latitude: number; longitude: number }>;
  };
  const codes = new Set(BULACAN_LOCALITIES.map((locality) => locality.code));
  const monitoredCodes = new Set<string>();

  assert.equal(MONITORED_WEATHER_POINTS.length, 10);
  for (const point of MONITORED_WEATHER_POINTS) {
    const source = fixture.points.find((item) => item.code === point.code);
    assert.ok(source, point.name);
    assert.ok(codes.has(point.code), point.name);
    assert.ok(!monitoredCodes.has(point.code), point.name);
    assert.equal(point.latitude, source.latitude);
    assert.equal(point.longitude, source.longitude);
    assert.ok(isWithinBulacan(point.latitude, point.longitude), point.name);
    monitoredCodes.add(point.code);
  }
  assert.ok(WEATHER_POINT_SET_VERSION.startsWith(BULACAN_SCOPE_VERSION));
});

test("outside coordinates stop before a provider or reverse-geocode request", async (t) => {
  let requests = 0;
  t.mock.method(globalThis, "fetch", async () => {
    requests += 1;
    return json(forecast());
  });

  await assert.rejects(
    () => getWeatherByCoordinates(14.6091, 121.0223),
    (error: unknown) => error instanceof Error && error.message === OUTSIDE_WEATHER_SCOPE_MESSAGE,
  );
  assert.equal(requests, 0);
});

test("a forged coordinate label cannot misname a Bulacan point", async (t) => {
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    assert.match(String(input), /api\.open-meteo\.com/);
    return json(forecast());
  });

  const result = await getWeatherByCoordinates(14.9151703, 120.7662073, "Manila");
  assert.ok(isWithinBulacan(result.location.latitude, result.location.longitude));
  assert.doesNotMatch(result.location.name, /Manila/i);
  const forgedLocality = await getWeatherByCoordinates(14.9151703, 120.7662073, "San Miguel");
  assert.doesNotMatch(forgedLocality.location.name, /San Miguel/i);
});

test("overview retains valid localities and names a failed provider point", async (t) => {
  const urls: string[] = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = String(input);
    urls.push(url);
    const coordinates = new URL(url).searchParams.get("latitude")?.split(",") ?? [];
    if (coordinates.length === MONITORED_WEATHER_POINTS.length) {
      return json(MONITORED_WEATHER_POINTS.map((_, index) => index === 1 ? {} : forecast()));
    }
    return json({ error: "provider unavailable" }, 503);
  });

  const overview = await getWeatherOverview();
  assert.equal(overview.monitoredLocationCount, 10);
  assert.equal(overview.locations.length, 9);
  assert.deepEqual(overview.unavailableLocations, [MONITORED_WEATHER_POINTS[1].name]);
  assert.ok(overview.fetchedAt.length > 0);
  assert.equal(urls.length, 2);
  assert.ok(overview.locations.every((location) => isWithinBulacan(location.latitude, location.longitude)));
});

test("a shortened batch cannot assign another locality’s forecast to a point", async (t) => {
  let requests = 0;
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    requests += 1;
    const coordinates = new URL(String(input)).searchParams.get("latitude")?.split(",") ?? [];
    if (coordinates.length > 1) {
      return json([forecast(8)]);
    }
    return json(forecast(0));
  });

  const overview = await getWeatherOverview();
  assert.equal(requests, MONITORED_WEATHER_POINTS.length + 1);
  assert.equal(overview.locations.length, MONITORED_WEATHER_POINTS.length);
  assert.ok(overview.locations.every((location) => location.precipitation === 0));
  assert.deepEqual(overview.unavailableLocations, []);
});

test("geocoding filters by polygon even when an outside result has a Bulacan label", async (t) => {
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    assert.match(String(input), /geocoding-api\.open-meteo\.com/);
    return json({ results: [
      { name: "Calumpit", latitude: 14.6091, longitude: 121.0223, country_code: "PH", admin1: "Bulacan" },
      { name: "Calumpit", latitude: 14.9151703, longitude: 120.7662073, country_code: "PH", admin1: "Bulacan" },
    ] });
  });

  const result = await searchPhilippineLocation("Calumpit");
  assert.equal(result.latitude, 14.9151703);
});

test("geocoding returns an explicit scope error for an outside-only match", async (t) => {
  t.mock.method(globalThis, "fetch", async () => json({ results: [
    { name: "Manila", latitude: 14.6091, longitude: 121.0223, country_code: "PH", admin1: "Metro Manila" },
  ] }));

  await assert.rejects(
    () => searchPhilippineLocation("Manila"),
    (error: unknown) => error instanceof Error && error.message === OUTSIDE_WEATHER_SCOPE_MESSAGE,
  );
});
