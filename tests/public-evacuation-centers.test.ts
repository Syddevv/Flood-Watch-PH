import assert from "node:assert/strict";
import test from "node:test";
import type { EvacuationCenter } from "@prisma/client";

import { parseCenterPayload } from "../lib/admin-evacuation";
import { isPublishableCenter, toPublicCenter } from "../lib/public-evacuation-centers";

const recent = new Date();
const validCenter = {
  id: "center-1", name: "Official Bulacan Center", address: "Poblacion, Calumpit",
  city: "Calumpit", province: "Bulacan", latitude: 14.9169, longitude: 120.7657,
  facilities: [], status: "available", verificationStatus: "verified",
  sourceType: "official_lgu", sourceName: "Calumpit LGU",
  sourceUrl: "https://calumpit.gov.ph/centers", lastVerifiedAt: recent,
  availabilityConfirmedAt: recent, isArchived: false, estimatedCapacity: 100,
  barangay: null, description: null, scopeVersion: "osm-1504656-2026-10-14",
  contactNumber: null, region: "Region III", notes: null,
  archivedAt: null, archivedByUserId: null, updatedByUserId: null,
  createdAt: recent, updatedAt: recent,
} satisfies EvacuationCenter;

test("only sourced, dated, in-province, non-archived official centers are public", () => {
  assert.equal(isPublishableCenter(validCenter), true);
  for (const changed of [
    { isArchived: true },
    { province: "Pampanga" },
    { latitude: 14.5, longitude: 121.5 },
    { verificationStatus: "needs_verification" },
    { sourceType: "sample_demo" },
    { sourceUrl: null },
    { sourceUrl: "javascript:alert(1)" },
    { lastVerifiedAt: null },
  ]) {
    assert.equal(isPublishableCenter({ ...validCenter, ...changed }), false, JSON.stringify(changed));
  }
});

test("estimated capacity never creates an occupancy or availability claim", () => {
  const publicCenter = toPublicCenter({ ...validCenter, availabilityConfirmedAt: null });
  assert.equal(publicCenter.availability, "unknown");
  assert.equal(publicCenter.estimatedCapacity, 100);
  assert.equal("occupancyCount" in publicCenter, false);
  const stale = toPublicCenter({ ...validCenter, lastVerifiedAt: new Date("2020-01-01") });
  assert.equal(stale.verificationStatus, "outdated");
  assert.equal(stale.availability, "unknown");
});

test("admin center input rejects out-of-province, bad capacity, and unsourced verification", () => {
  const input = {
    name: "Official Bulacan Center", address: "Poblacion, Calumpit", city: "Calumpit",
    province: "Bulacan", latitude: 14.9169, longitude: 120.7657,
    facilities: [], status: "needs_verification", verificationStatus: "needs_verification",
    sourceType: "official_lgu",
  };
  assert.ok(parseCenterPayload(input).data);
  assert.match(parseCenterPayload({ ...input, province: "Pampanga" }).error ?? "", /Bulacan/);
  assert.match(parseCenterPayload({ ...input, estimatedCapacity: -1 }).error ?? "", /capacity/);
  assert.match(parseCenterPayload({ ...input, verificationStatus: "verified" }).error ?? "", /official HTTPS/);
});
