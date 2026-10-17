import assert from "node:assert/strict";
import test from "node:test";

import {
  BULACAN_POLYGONS,
  distanceToBulacanBoundaryMeters,
  isWithinBulacan,
} from "@/lib/bulacan-scope";
import {
  ONSITE_REPORT_POLICY,
  validateOnsiteReportEvidence,
} from "@/lib/onsite-report-policy";

const NOW = new Date("2026-10-17T06:00:00.000Z");
const GPS_LATITUDE = 14.916;
const GPS_LONGITUDE = 120.766;

function evidenceForm(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("gpsLatitude", String(GPS_LATITUDE));
  formData.set("gpsLongitude", String(GPS_LONGITUDE));
  formData.set("gpsAccuracyMeters", "25");
  formData.set("gpsCapturedAt", new Date(NOW.getTime() - 30_000).toISOString());
  formData.set("photoCapturedAt", new Date(NOW.getTime() - 60_000).toISOString());

  for (const [key, value] of Object.entries(overrides)) {
    formData.set(key, value);
  }

  return formData;
}

function validate(formData = evidenceForm(), overrides: Partial<Parameters<typeof validateOnsiteReportEvidence>[1]> = {}) {
  return validateOnsiteReportEvidence(formData, {
    reportLatitude: GPS_LATITUDE,
    reportLongitude: GPS_LONGITUDE,
    imagePresent: true,
    now: NOW,
    ...overrides,
  });
}

test("fresh nearby evidence passes with the recorded provisional policy", () => {
  const result = validate();

  assert.equal(result.error, undefined);
  assert.equal(result.data?.policyVersion, ONSITE_REPORT_POLICY.version);
  assert.equal(result.data?.gpsAccuracyMeters, 25);
});

test("an image and capture timestamp are both required", () => {
  assert.equal(validate(evidenceForm(), { imagePresent: false }).code, "image_required");
  assert.equal(validate(evidenceForm({ photoCapturedAt: "" })).code, "photo_time_required");
});

test("GPS age and accuracy enforce their exact threshold boundaries", () => {
  const exactAge = new Date(
    NOW.getTime() - ONSITE_REPORT_POLICY.maximumGpsAgeMs,
  ).toISOString();
  assert.equal(
    validate(evidenceForm({ gpsCapturedAt: exactAge, gpsAccuracyMeters: "100" })).error,
    undefined,
  );

  assert.equal(
    validate(
      evidenceForm({
        gpsCapturedAt: new Date(
          NOW.getTime() - ONSITE_REPORT_POLICY.maximumGpsAgeMs - 1,
        ).toISOString(),
      }),
    ).code,
    "gps_stale",
  );
  assert.equal(validate(evidenceForm({ gpsAccuracyMeters: "100.1" })).code, "gps_inaccurate");
});

test("photo age enforces the exact five-minute threshold", () => {
  const exactAge = new Date(
    NOW.getTime() - ONSITE_REPORT_POLICY.maximumPhotoAgeMs,
  ).toISOString();
  assert.equal(validate(evidenceForm({ photoCapturedAt: exactAge })).error, undefined);

  const stale = new Date(
    NOW.getTime() - ONSITE_REPORT_POLICY.maximumPhotoAgeMs - 1,
  ).toISOString();
  assert.equal(validate(evidenceForm({ photoCapturedAt: stale })).code, "photo_stale");
});

test("the report point cannot exceed 150 metres plus GPS uncertainty", () => {
  const withinLimitLatitude = GPS_LATITUDE + 174 / 111_320;
  const outsideLimitLatitude = GPS_LATITUDE + 176 / 111_320;

  assert.equal(validate(evidenceForm(), { reportLatitude: withinLimitLatitude }).error, undefined);
  assert.equal(
    validate(evidenceForm(), { reportLatitude: outsideLimitLatitude }).code,
    "location_too_far",
  );
});

test("outside and boundary-uncertain GPS fixes are rejected", () => {
  assert.equal(
    validate(evidenceForm({ gpsLatitude: "14.6507", gpsLongitude: "121.1029" })).code,
    "gps_outside_scope",
  );

  const [edgeLatitude, edgeLongitude] = BULACAN_POLYGONS[0][0][0];
  const candidates = Array.from({ length: 100 }, (_, index) => {
    const fraction = (index + 1) / 10_000;
    return [
      edgeLatitude + (GPS_LATITUDE - edgeLatitude) * fraction,
      edgeLongitude + (GPS_LONGITUDE - edgeLongitude) * fraction,
    ] as const;
  });
  const uncertainPoint = candidates.find(
    ([latitude, longitude]) =>
      isWithinBulacan(latitude, longitude) &&
      distanceToBulacanBoundaryMeters(latitude, longitude) < 100,
  );
  assert.ok(uncertainPoint);
  const [uncertainLatitude, uncertainLongitude] = uncertainPoint;
  assert.equal(
    validate(
      evidenceForm({
        gpsLatitude: String(uncertainLatitude),
        gpsLongitude: String(uncertainLongitude),
        gpsAccuracyMeters: "100",
      }),
      { reportLatitude: uncertainLatitude, reportLongitude: uncertainLongitude },
    ).code,
    "border_review_required",
  );
});
