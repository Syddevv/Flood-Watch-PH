import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_REPORT_LOCATION_SOURCE,
  MAX_GPS_ACCURACY_METERS,
  REPORT_LOCATION_SOURCES,
  describeReportLocationProvenance,
  describeReportLocationSource,
  formatGpsAccuracyLabel,
  parseGpsAccuracyMeters,
  parsePhotoCapturedAt,
  parseReportLocationSource,
} from "@/lib/report-location-metadata";

test("every supported location source round-trips through the parser", () => {
  for (const source of REPORT_LOCATION_SOURCES) {
    assert.equal(parseReportLocationSource(source), source);
  }
});

test("unknown, empty, and missing location sources fall back to manual", () => {
  assert.equal(parseReportLocationSource("satellite"), DEFAULT_REPORT_LOCATION_SOURCE);
  assert.equal(parseReportLocationSource(""), DEFAULT_REPORT_LOCATION_SOURCE);
  assert.equal(parseReportLocationSource("   "), DEFAULT_REPORT_LOCATION_SOURCE);
  assert.equal(parseReportLocationSource(null), DEFAULT_REPORT_LOCATION_SOURCE);
  assert.equal(parseReportLocationSource(undefined), DEFAULT_REPORT_LOCATION_SOURCE);
  // A client could send anything; casing is not silently coerced.
  assert.equal(parseReportLocationSource("GPS"), DEFAULT_REPORT_LOCATION_SOURCE);
});

test("gps accuracy is accepted only for gps fixes", () => {
  assert.equal(parseGpsAccuracyMeters("12.4", "gps"), 12.4);
  // A hand-typed coordinate claiming +/-2 m would be a lie the UI then renders
  // as trustworthy, so accuracy is dropped for every non-GPS source.
  assert.equal(parseGpsAccuracyMeters("2", "manual"), null);
  assert.equal(parseGpsAccuracyMeters("2", "map"), null);
  assert.equal(parseGpsAccuracyMeters("2", "search"), null);
});

test("gps accuracy rejects non-positive, non-finite, and absurd values", () => {
  assert.equal(parseGpsAccuracyMeters("0", "gps"), null);
  assert.equal(parseGpsAccuracyMeters("-5", "gps"), null);
  assert.equal(parseGpsAccuracyMeters("abc", "gps"), null);
  assert.equal(parseGpsAccuracyMeters("", "gps"), null);
  assert.equal(parseGpsAccuracyMeters(null, "gps"), null);
  assert.equal(parseGpsAccuracyMeters(String(MAX_GPS_ACCURACY_METERS + 1), "gps"), null);
  assert.equal(parseGpsAccuracyMeters(String(MAX_GPS_ACCURACY_METERS), "gps"), MAX_GPS_ACCURACY_METERS);
});

test("gps accuracy is rounded to a tenth of a metre", () => {
  assert.equal(parseGpsAccuracyMeters("12.4567", "gps"), 12.5);
  assert.equal(parseGpsAccuracyMeters("30", "gps"), 30);
});

test("photo capture times outside a sane window are discarded", () => {
  const now = new Date("2026-08-26T12:00:00.000Z");
  const inWindow = new Date("2026-08-26T11:30:00.000Z");

  assert.deepEqual(parsePhotoCapturedAt(inWindow.toISOString(), now), inWindow);
  // Small clock skew is tolerated; a client claiming the future is not.
  assert.deepEqual(
    parsePhotoCapturedAt(new Date("2026-08-26T12:00:30.000Z").toISOString(), now),
    new Date("2026-08-26T12:00:30.000Z"),
  );
  assert.equal(parsePhotoCapturedAt(new Date("2026-08-26T12:05:00.000Z").toISOString(), now), null);
  assert.equal(parsePhotoCapturedAt(new Date("2026-08-25T11:00:00.000Z").toISOString(), now), null);
  assert.equal(parsePhotoCapturedAt("not-a-date", now), null);
  assert.equal(parsePhotoCapturedAt("", now), null);
  assert.equal(parsePhotoCapturedAt(null, now), null);
});

test("location sources render human labels", () => {
  assert.equal(describeReportLocationSource("gps"), "GPS");
  assert.equal(describeReportLocationSource("map"), "Map pin");
  assert.equal(describeReportLocationSource("search"), "Search result");
  assert.equal(describeReportLocationSource("manual"), "Manual entry");
});

test("accuracy labels switch to kilometres past a thousand metres", () => {
  assert.equal(formatGpsAccuracyLabel(30), "±30 m");
  assert.equal(formatGpsAccuracyLabel(30.4), "±30 m");
  assert.equal(formatGpsAccuracyLabel(999), "±999 m");
  assert.equal(formatGpsAccuracyLabel(1200), "±1.2 km");
  assert.equal(formatGpsAccuracyLabel(0), "");
  assert.equal(formatGpsAccuracyLabel(null), "");
});

test("provenance combines the source label with accuracy when present", () => {
  assert.equal(describeReportLocationProvenance("gps", 30), "GPS · ±30 m");
  assert.equal(describeReportLocationProvenance("gps", null), "GPS");
  assert.equal(describeReportLocationProvenance("map", null), "Map pin");
  // Accuracy is never shown next to a source that cannot have measured it.
  assert.equal(describeReportLocationProvenance("manual", 30), "Manual entry");
});
