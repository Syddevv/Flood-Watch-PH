import assert from "node:assert/strict";
import test from "node:test";

import { findNearestMatchingReport } from "@/lib/incident-matching";

const NOW = new Date("2026-08-23T12:00:00.000Z");
const ORIGIN = { latitude: 14.9333, longitude: 120.7667 }; // Calumpit, Bulacan

function createCandidate(overrides: Record<string, unknown> = {}) {
  return {
    incidentId: "incident_1",
    latitude: ORIGIN.latitude,
    longitude: ORIGIN.longitude,
    status: "Needs More Confirmation",
    severity: "Moderate",
    confirmationCount: 0,
    resolvedCount: 0,
    createdAt: NOW,
    updatedAt: NOW,
    lastActivityAt: NOW,
    resolvedAt: null,
    archivedAt: null,
    ...overrides,
  };
}

function offsetLatitude(latitude: number, meters: number) {
  return latitude + meters / 111_320;
}

test("matches a candidate within the default radius and time window", () => {
  const candidate = createCandidate();
  const result = findNearestMatchingReport([candidate], ORIGIN, NOW);

  assert.ok(result);
  assert.equal(result.incidentId, "incident_1");
  assert.equal(result.distanceMeters, 0);
});

test("matches a candidate at the exact same coordinates", () => {
  const candidate = createCandidate({
    latitude: ORIGIN.latitude,
    longitude: ORIGIN.longitude,
  });
  const result = findNearestMatchingReport([candidate], ORIGIN, NOW);

  assert.ok(result);
  assert.equal(result.distanceMeters, 0);
});

test("does not match a candidate just outside the radius", () => {
  const candidate = createCandidate({
    latitude: offsetLatitude(ORIGIN.latitude, 600),
  });
  const result = findNearestMatchingReport([candidate], ORIGIN, NOW, {
    radiusMeters: 300,
  });

  assert.equal(result, null);
});

test("does not match a candidate at the same spot but outside the time window", () => {
  const staleActivity = new Date(NOW.getTime() - 13 * 60 * 60 * 1000);
  const candidate = createCandidate({ lastActivityAt: staleActivity });
  const result = findNearestMatchingReport([candidate], ORIGIN, NOW, {
    timeWindowMs: 12 * 60 * 60 * 1000,
  });

  assert.equal(result, null);
});

test("excludes candidates whose derived lifecycle status is no longer active", () => {
  const resolved = createCandidate({ incidentId: "resolved", resolvedCount: 3 });
  const archived = createCandidate({
    incidentId: "archived",
    archivedAt: NOW,
  });
  const receded = createCandidate({ incidentId: "receded", resolvedCount: 2 });

  assert.equal(findNearestMatchingReport([resolved], ORIGIN, NOW), null);
  assert.equal(findNearestMatchingReport([archived], ORIGIN, NOW), null);
  assert.equal(findNearestMatchingReport([receded], ORIGIN, NOW), null);
});

test("picks the nearest of multiple eligible candidates", () => {
  const far = createCandidate({
    incidentId: "far",
    latitude: offsetLatitude(ORIGIN.latitude, 200),
  });
  const near = createCandidate({
    incidentId: "near",
    latitude: offsetLatitude(ORIGIN.latitude, 50),
  });

  const result = findNearestMatchingReport([far, near], ORIGIN, NOW);

  assert.ok(result);
  assert.equal(result.incidentId, "near");
});

test("matching near Calumpit coordinates behaves the same as anywhere else", () => {
  // Regression guard: P0 matching must be radius/time only, with no
  // geofence-shaped special case near the future Calumpit boundary (P2).
  const calumpitCandidate = createCandidate({
    latitude: 14.9333,
    longitude: 120.7667,
  });
  const result = findNearestMatchingReport(
    [calumpitCandidate],
    { latitude: 14.9333, longitude: 120.7667 },
    NOW,
  );

  assert.ok(result);
  assert.equal(result.distanceMeters, 0);
});
