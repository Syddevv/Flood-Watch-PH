import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_REPORT_SEARCH_LENGTH,
  MAX_WEATHER_LOCATION_NAME_LENGTH,
  MAX_WEATHER_QUERY_LENGTH,
  normalizeBoundedText,
  parseReportFilters,
  roundWeatherCoordinate,
} from "@/lib/api-utils";
import {
  isValidConfirmationType,
  isValidLatitude,
  isValidLongitude,
  isValidReportCategory,
  isValidReportSeverity,
  isValidReportSourceType,
  isValidReportStatus,
} from "@/lib/validations";

test("bounded text normalization rejects oversized provider and database inputs", () => {
  assert.equal(
    normalizeBoundedText("  Manila   City ", MAX_WEATHER_QUERY_LENGTH),
    "Manila City",
  );
  assert.equal(
    normalizeBoundedText(
      "x".repeat(MAX_WEATHER_LOCATION_NAME_LENGTH + 1),
      MAX_WEATHER_LOCATION_NAME_LENGTH,
    ),
    undefined,
  );
});

test("report search filters reject oversized search terms", () => {
  const result = parseReportFilters(
    new URLSearchParams({
      search: "x".repeat(MAX_REPORT_SEARCH_LENGTH + 1),
    }),
  );
  assert.equal(
    result.error,
    `Search must not exceed ${MAX_REPORT_SEARCH_LENGTH} characters.`,
  );
});

test("weather coordinates are rounded to a stable cache precision", () => {
  assert.equal(roundWeatherCoordinate(14.59951234), 14.5995);
  assert.equal(roundWeatherCoordinate(-121.234567), -121.2346);
});

test("report enum validation accepts supported values", () => {
  assert.equal(isValidReportSeverity("Critical"), true);
  assert.equal(isValidReportCategory("Flooding"), true);
  assert.equal(isValidReportSourceType("Community"), true);
  assert.equal(isValidConfirmationType("resolved"), true);
  assert.equal(isValidReportStatus("Confirmed by Community"), true);
  assert.equal(isValidReportStatus("active"), true);
});

test("report enum validation rejects unknown and incorrectly-cased values", () => {
  assert.equal(isValidReportSeverity("critical"), false);
  assert.equal(isValidReportCategory("Tsunami"), false);
  assert.equal(isValidReportSourceType("Anonymous"), false);
  assert.equal(isValidConfirmationType("yes"), false);
  assert.equal(isValidReportStatus("Deleted"), false);
});

test("latitude validation enforces finite geographic bounds", () => {
  assert.equal(isValidLatitude(-90), true);
  assert.equal(isValidLatitude(90), true);
  assert.equal(isValidLatitude(-90.0001), false);
  assert.equal(isValidLatitude(90.0001), false);
  assert.equal(isValidLatitude(Number.NaN), false);
  assert.equal(isValidLatitude(Number.POSITIVE_INFINITY), false);
});

test("longitude validation enforces finite geographic bounds", () => {
  assert.equal(isValidLongitude(-180), true);
  assert.equal(isValidLongitude(180), true);
  assert.equal(isValidLongitude(-180.0001), false);
  assert.equal(isValidLongitude(180.0001), false);
  assert.equal(isValidLongitude(Number.NaN), false);
  assert.equal(isValidLongitude(Number.NEGATIVE_INFINITY), false);
});
