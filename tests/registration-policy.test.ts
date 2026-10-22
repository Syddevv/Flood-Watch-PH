import assert from "node:assert/strict";
import test from "node:test";

import boundary from "@/data/bulacan-boundary.json";
import { checkRegistrationLocation, isValidRegistrationPassword, normalizeFullName, registrationEmail } from "@/lib/registration-policy";

test("registration fields accept Philippine names and reject missing or weak information", () => {
  assert.equal(normalizeFullName("  María   Dela-Cruz  "), "María Dela-Cruz");
  assert.equal(normalizeFullName("John O'Brien"), "John O'Brien");
  assert.equal(normalizeFullName("123 456"), null);
  assert.equal(normalizeFullName("Juan"), null);
  assert.equal(registrationEmail(" Resident@Example.com "), "resident@example.com");
  assert.equal(registrationEmail("invalid"), null);
  assert.equal(isValidRegistrationPassword("strongpassword1"), true);
  assert.equal(isValidRegistrationPassword("allletterslong"), false);
});

test("a fresh accurate fix must sit entirely inside the sourced Bulacan boundary", () => {
  const now = Date.now();
  const inside = { latitude: 14.91517, longitude: 120.76621, accuracy: 20, capturedAt: now };
  assert.equal(checkRegistrationLocation(inside, now), "valid");
  assert.equal(checkRegistrationLocation({ ...inside, longitude: 120.9842, latitude: 14.5995 }, now), "outside");
  assert.equal(checkRegistrationLocation({ ...inside, accuracy: 1000 }, now), "unavailable");
  const [boundaryLongitude, boundaryLatitude] = boundary.geometry.coordinates[0][0];
  assert.equal(checkRegistrationLocation({ ...inside, latitude: boundaryLatitude, longitude: boundaryLongitude }, now), "unavailable");
  assert.equal(checkRegistrationLocation({ ...inside, capturedAt: now - 3 * 60_000 }, now), "unavailable");
  assert.equal(checkRegistrationLocation({ ...inside, latitude: "14.91517" }, now), "unavailable");
});
