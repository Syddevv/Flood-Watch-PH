import assert from "node:assert/strict";
import test from "node:test";

import {
  isValidConfirmationType,
  isValidLatitude,
  isValidLongitude,
  isValidReportCategory,
  isValidReportSeverity,
  isValidReportSourceType,
  isValidReportStatus,
} from "@/lib/validations";

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
