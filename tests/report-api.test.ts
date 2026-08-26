import assert from "node:assert/strict";
import test from "node:test";

import { OUTSIDE_CALUMPIT_ERROR_MESSAGE } from "@/lib/calumpit-boundary";
import {
  canAccessArchivedReport,
  parseReportDetailsFormData,
  parseReportRequestFormData,
  parseReportUpdateFormData,
  trimText,
} from "@/lib/report-api";

test("archived reports require an explicit request from the owner session", () => {
  const report = { ownerSessionHash: "owner-session", userId: null };

  assert.equal(canAccessArchivedReport(report, {}, true), false);
  assert.equal(canAccessArchivedReport(report, { sessionHash: "other-session" }, true), false);
  assert.equal(canAccessArchivedReport(report, { sessionHash: "owner-session" }, false), false);
  assert.equal(canAccessArchivedReport(report, { sessionHash: "owner-session" }, true), true);
});

test("malformed multipart requests return a client-safe parsing error", async () => {
  const request = new Request("http://localhost/api/reports", {
    method: "POST",
    headers: {
      "content-type": "multipart/form-data; boundary=broken",
    },
    body: "not-valid-multipart-data",
  });

  assert.deepEqual(await parseReportRequestFormData(request), {
    error: "Invalid multipart form data.",
    status: 400,
  });
});

test("oversized multipart requests are rejected before parsing", async () => {
  const request = new Request("http://localhost/api/reports", {
    method: "POST",
    headers: {
      "content-type": "multipart/form-data; boundary=unused",
      "content-length": String(6 * 1024 * 1024),
    },
    body: "unused",
  });

  assert.deepEqual(await parseReportRequestFormData(request), {
    error: "Report form data must not exceed 5.25 MB.",
    status: 413,
  });
});

test("oversized multipart requests without content length are rejected after parsing", async () => {
  const formData = new FormData();
  formData.set("image", new File([new Uint8Array(6 * 1024 * 1024)], "large.png", {
    type: "image/png",
  }));
  const request = new Request("http://localhost/api/reports", {
    method: "POST",
    body: formData,
  });

  assert.deepEqual(await parseReportRequestFormData(request), {
    error: "Report form data must not exceed 5.25 MB.",
    status: 413,
  });
});

test("valid multipart requests return their form data", async () => {
  const input = new FormData();
  input.set("title", "Flooded street");
  const request = new Request("http://localhost/api/reports", {
    method: "POST",
    body: input,
  });
  const result = await parseReportRequestFormData(request);

  assert.ok("formData" in result);
  assert.equal(result.formData?.get("title"), "Flooded street");
});

test("report details are normalized and parsed into typed values", () => {
  const formData = new FormData();
  formData.set("title", "  Flooded   street  " );
  formData.set("description", " Water is rising near the bridge. " );
  formData.set("category", "Flooding");
  formData.set("severity", "High");
  formData.set("locationName", "  Marikina   City " );
  formData.set("reportedByName", "  Juan   Dela Cruz " );
  formData.set("latitude", "14.916");
  formData.set("longitude", "120.766");

  assert.deepEqual(parseReportDetailsFormData(formData), {
    data: {
      title: "Flooded street",
      description: "Water is rising near the bridge.",
      category: "Flooding",
      severity: "High",
      locationName: "Marikina City",
      reportedByName: "Juan Dela Cruz",
      latitude: 14.916,
      longitude: 120.766,
      locationSource: "manual",
      gpsAccuracyMeters: null,
      photoCapturedAt: null,
    },
    forceNewIncident: false,
  });
});

test("capture metadata is parsed alongside the report details", () => {
  const now = new Date("2026-08-26T12:00:00.000Z");
  const capturedAt = new Date("2026-08-26T11:55:00.000Z");
  const formData = new FormData();
  formData.set("title", "Flooded street");
  formData.set("description", "Water is rising near the bridge.");
  formData.set("category", "Flooding");
  formData.set("severity", "High");
  formData.set("locationName", "Poblacion, Calumpit");
  formData.set("latitude", "14.916");
  formData.set("longitude", "120.766");
  formData.set("locationSource", "gps");
  formData.set("gpsAccuracyMeters", "12.44");
  formData.set("photoCapturedAt", capturedAt.toISOString());

  const result = parseReportDetailsFormData(formData, now);

  assert.equal(result.data?.locationSource, "gps");
  assert.equal(result.data?.gpsAccuracyMeters, 12.4);
  assert.deepEqual(result.data?.photoCapturedAt, capturedAt);
});

test("a spoofed accuracy on a non-GPS source is discarded, never a 500", () => {
  const formData = new FormData();
  formData.set("title", "Flooded street");
  formData.set("description", "Water is rising near the bridge.");
  formData.set("category", "Flooding");
  formData.set("severity", "High");
  formData.set("locationName", "Poblacion, Calumpit");
  formData.set("latitude", "14.916");
  formData.set("longitude", "120.766");
  formData.set("locationSource", "hack-attempt");
  formData.set("gpsAccuracyMeters", "1");

  const result = parseReportDetailsFormData(formData);

  assert.equal(result.data?.locationSource, "manual");
  assert.equal(result.data?.gpsAccuracyMeters, null);
});

test("coordinates are normalized to six decimal places before storage", () => {
  const formData = new FormData();
  formData.set("title", "Flooded street");
  formData.set("description", "Water is rising near the bridge.");
  formData.set("category", "Flooding");
  formData.set("severity", "High");
  formData.set("locationName", "Poblacion, Calumpit");
  // An unrounded GPS double, as navigator.geolocation actually reports it.
  formData.set("latitude", "14.9161234567891");
  formData.set("longitude", "120.7659876543211");

  const result = parseReportDetailsFormData(formData);

  assert.equal(result.data?.latitude, 14.916123);
  assert.equal(result.data?.longitude, 120.765988);
});

test("parsed report data holds only FloodReport columns so it can be spread into Prisma", () => {
  // Regression guard: forceNewIncident is a submission flag, not a column.
  // PATCH /api/reports/[id] spreads this object straight into
  // prisma.floodReport.update, so a stray key there is a 500 on every edit.
  const formData = new FormData();
  formData.set("title", "Flooded street");
  formData.set("description", "Water is rising near the bridge.");
  formData.set("category", "Flooding");
  formData.set("severity", "High");
  formData.set("locationName", "Poblacion, Calumpit");
  formData.set("latitude", "14.916");
  formData.set("longitude", "120.766");
  formData.set("forceNewIncident", "true");

  const result = parseReportDetailsFormData(formData);

  assert.ok(result.data);
  assert.equal("forceNewIncident" in result.data, false);
  assert.equal(result.forceNewIncident, true);
});

test("forceNewIncident parses the literal string 'true', defaults to false otherwise", () => {
  const formData = new FormData();
  formData.set("title", "Flooded street");
  formData.set("description", "Water is rising near the bridge.");
  formData.set("category", "Flooding");
  formData.set("severity", "High");
  formData.set("locationName", "Marikina City");
  formData.set("latitude", "14.916");
  formData.set("longitude", "120.766");
  formData.set("forceNewIncident", "true");

  const result = parseReportDetailsFormData(formData);
  assert.equal(result.forceNewIncident, true);

  formData.set("forceNewIncident", "yes");
  assert.equal(parseReportDetailsFormData(formData).forceNewIncident, false);
});

test("report details reject invalid coordinates and enum values", () => {
  const formData = new FormData();
  formData.set("title", "Flooded street");
  formData.set("description", "Water is rising.");
  formData.set("category", "Flooding");
  formData.set("severity", "Extreme");
  formData.set("locationName", "Marikina City");
  formData.set("latitude", "14.916");
  formData.set("longitude", "120.766");

  assert.deepEqual(parseReportDetailsFormData(formData), {
    error: "Invalid severity value.",
  });

  formData.set("severity", "High");
  formData.set("latitude", "91");
  assert.deepEqual(parseReportDetailsFormData(formData), {
    error: "Invalid latitude value.",
  });
});

test("report updates accept the legacy description field and validate severity", () => {
  const formData = new FormData();
  formData.set("description", "  Water is now   receding. " );
  formData.set("severity", "Moderate");

  assert.deepEqual(parseReportUpdateFormData(formData), {
    data: {
      message: "Water is now receding.",
      severity: "Moderate",
    },
  });

  formData.set("severity", "Extreme");
  assert.deepEqual(parseReportUpdateFormData(formData), {
    error: "Invalid severity value.",
  });
});

test("text normalization safely handles non-string input", () => {
  assert.equal(trimText("  multiple   spaces \n remain  "), "multiple spaces remain");
  assert.equal(trimText(null), "");
});

test("report details outside Calumpit are rejected with the shared boundary message", () => {
  const formData = new FormData();
  formData.set("title", "Flooded street");
  formData.set("description", "Water is rising.");
  formData.set("category", "Flooding");
  formData.set("severity", "High");
  formData.set("locationName", "Marikina City");
  formData.set("latitude", "14.6507");
  formData.set("longitude", "121.1029");

  assert.deepEqual(parseReportDetailsFormData(formData), {
    error: OUTSIDE_CALUMPIT_ERROR_MESSAGE,
  });
});
