import assert from "node:assert/strict";
import test from "node:test";

import { OUTSIDE_BULACAN_ERROR_MESSAGE } from "@/lib/bulacan-scope";
import {
  RESCUE_MAX_PEOPLE,
  RESCUE_MAX_SITUATION_LENGTH,
  RESCUE_MIN_PEOPLE,
  clampRescuePeopleCount,
  formatRescuePeopleLabel,
  toggleRescueAssistanceTag,
  validateRescueRequestForm,
  serializeRescueSubmission,
} from "@/lib/rescue-request-form";

test("serializes manual rescue locations separately from onsite report evidence", () => {
  const payload = serializeRescueSubmission({ forWhom: "self", assistedPersonName: "", relationship: "", alternateContact: "", localityCode: "0301407000", barangay: "Meysulao", linkedReportId: "", locationName: "Near the school", latitude: "", longitude: "", locationSource: "manual", gpsAccuracyMeters: null, peopleCount: 2, assistanceTagIds: ["children", "none"], situation: "Water is rising", contactNumber: "09171234567" });
  assert.equal(payload.locationUncertainty, "manual");
  assert.equal(payload.latitude, null);
  assert.equal(payload.primaryContact, "09171234567");
  assert.deepEqual(payload.vulnerabilityTags, ["children"]);
  assert.equal(validateRescueRequestForm({ locationName: "Near the school", latitude: "", longitude: "", situation: "Water is rising", allowManual: true }), null);
});

// Poblacion, Calumpit - well inside the municipal polygon.
const CALUMPIT = { latitude: "14.916", longitude: "120.766" };
// Marikina City lies outside Bulacan.
const OUTSIDE_BULACAN = { latitude: "14.6507", longitude: "121.1029" };

const VALID_INPUT = {
  locationName: "Brgy. Meysulao, Calumpit",
  latitude: CALUMPIT.latitude,
  longitude: CALUMPIT.longitude,
  situation: "Water is chest deep and still rising on our street.",
};

test("people count is clamped to the supported range", () => {
  assert.equal(clampRescuePeopleCount(4), 4);
  assert.equal(clampRescuePeopleCount(0), RESCUE_MIN_PEOPLE);
  assert.equal(clampRescuePeopleCount(-12), RESCUE_MIN_PEOPLE);
  assert.equal(clampRescuePeopleCount(999), RESCUE_MAX_PEOPLE);
  // A blank or non-numeric stepper input must not produce NaN in the payload.
  assert.equal(clampRescuePeopleCount(Number.NaN), RESCUE_MIN_PEOPLE);
  assert.equal(clampRescuePeopleCount(3.7), 3);
});

test("people label is singular only for one person", () => {
  assert.equal(formatRescuePeopleLabel(1), "1 person");
  assert.equal(formatRescuePeopleLabel(2), "2 people");
  assert.equal(formatRescuePeopleLabel(12), "12 people");
});

test("assistance tags toggle on and off", () => {
  assert.deepEqual(toggleRescueAssistanceTag([], "children"), ["children"]);
  assert.deepEqual(
    toggleRescueAssistanceTag(["children"], "elderly"),
    ["children", "elderly"],
  );
  assert.deepEqual(toggleRescueAssistanceTag(["children", "elderly"], "children"), [
    "elderly",
  ]);
});

test("selecting None clears every other assistance tag", () => {
  assert.deepEqual(toggleRescueAssistanceTag(["children", "medical"], "none"), [
    "none",
  ]);
});

test("selecting a real need clears None", () => {
  assert.deepEqual(toggleRescueAssistanceTag(["none"], "pregnant"), ["pregnant"]);
});

test("None can be switched off like any other tag", () => {
  assert.deepEqual(toggleRescueAssistanceTag(["none"], "none"), []);
});

test("a fully filled Calumpit form validates", () => {
  assert.equal(validateRescueRequestForm(VALID_INPUT), null);
});

test("a missing location is rejected", () => {
  const error = validateRescueRequestForm({ ...VALID_INPUT, locationName: "   " });
  assert.equal(error, "Add the location where help is needed.");
});

test("an unpinned location is rejected", () => {
  const error = validateRescueRequestForm({
    ...VALID_INPUT,
    latitude: "",
    longitude: "",
  });
  assert.equal(
    error,
    "Pin your location with your current location or the map so responders can reach you.",
  );
});

test("coordinates outside Bulacan are rejected with the shared message", () => {
  const error = validateRescueRequestForm({
    ...VALID_INPUT,
    latitude: OUTSIDE_BULACAN.latitude,
    longitude: OUTSIDE_BULACAN.longitude,
  });
  assert.equal(error, OUTSIDE_BULACAN_ERROR_MESSAGE);
});

test("a too-short situation is rejected", () => {
  const error = validateRescueRequestForm({ ...VALID_INPUT, situation: "help" });
  assert.equal(
    error,
    "Describe your situation in at least 10 characters so responders know what to prepare.",
  );
});

test("a situation at exactly the maximum length is accepted", () => {
  const maxLengthSituation = "x".repeat(RESCUE_MAX_SITUATION_LENGTH);
  const error = validateRescueRequestForm({
    ...VALID_INPUT,
    situation: maxLengthSituation,
  });
  assert.equal(error, null);
});

test("an over-long situation is rejected", () => {
  const overLongSituation = "x".repeat(RESCUE_MAX_SITUATION_LENGTH + 1);
  const error = validateRescueRequestForm({
    ...VALID_INPUT,
    situation: overLongSituation,
  });
  assert.equal(error, `Situation must not exceed ${RESCUE_MAX_SITUATION_LENGTH} characters.`);
});

test("an over-long location name is rejected before the API sees it", () => {
  const error = validateRescueRequestForm({
    ...VALID_INPUT,
    locationName: "a".repeat(161),
  });
  assert.equal(error, "Location must not exceed 160 characters.");
});
