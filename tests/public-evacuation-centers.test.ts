import assert from "node:assert/strict";
import test from "node:test";
import type { EvacuationCenter } from "@prisma/client";

import { parseCenterPayload, parseOperationalConfirmation } from "../lib/admin-evacuation";
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
  externalKey: null, sourceSnapshot: null, sourceCheckedAt: null,
  facilityType: null, permanent: null, capacityFamilies: null,
  lastDocumentedEventDate: null, currentOccupancy: null, currentCapacity: null,
  adminEvidenceUrl: null, duplicateReviewNotes: null,
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
  assert.equal(publicCenter.openingStatus, "unknown");
  assert.equal(publicCenter.listingKind, "center");
  assert.equal(publicCenter.availabilityConfirmedAt, null);
  assert.equal(publicCenter.estimatedCapacity, 100);
  assert.equal("occupancyCount" in publicCenter, false);
  const stale = toPublicCenter({ ...validCenter, lastVerifiedAt: new Date("2020-01-01") });
  assert.equal(stale.verificationStatus, "outdated");
  assert.equal(stale.availability, "confirmed_available");
});

test("opening evidence remains distinct from listing research", () => {
  const researched = toPublicCenter({ ...validCenter, status: "available", availabilityConfirmedAt: null, sourceCheckedAt: recent });
  assert.equal(researched.openingStatus, "unknown");
  assert.equal(researched.availabilityConfirmedAt, null);
  assert.equal(researched.listingKind, "center");
  assert.equal(toPublicCenter({ ...validCenter, sourceType: "community_reference" }).listingKind, null);
  assert.equal(toPublicCenter({ ...validCenter, sourceUrl: null }).listingKind, null);
  assert.equal(toPublicCenter({ ...validCenter, availabilityConfirmedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) }).openingStatus, "unknown");
  assert.equal(toPublicCenter({ ...validCenter, availabilityConfirmedAt: new Date(Date.now() + 60_000) }).openingStatus, "unknown");
  for (const [status, expected] of [["available", "open"], ["closed", "closed"], ["full", "full"]]) {
    assert.equal(toPublicCenter({ ...validCenter, status }).openingStatus, expected);
  }
  assert.equal(toPublicCenter({ ...validCenter, status: "standby" }).openingStatus, "unknown");
});

test("descriptive barangay locations are listed as sites, not identified buildings", () => {
  const center = toPublicCenter({ ...validCenter, sourceSnapshot: { record: { notes: "Descriptive name generated from the barangay list; source does not identify the exact building." } } });
  assert.equal(center.listingKind, "site");
  assert.match(center.sourceNotes ?? "", /does not identify the exact building/);
});

test("online-mapped locations retain precision notes without promoting candidates to pins", () => {
  const mapped = toPublicCenter({ ...validCenter, sourceSnapshot: { record: {
    latitude: validCenter.latitude, longitude: validCenter.longitude,
    coordinate_precision: "campus", location_verification_status: "online_identity_match_not_field_verified",
    location_notes: "Campus grounds only; entrance not verified.",
  }, sources: [{ title: "Campus map", url: "https://example.gov.ph/campus", published_at: null }] } });
  assert.match(mapped.locationProvenance ?? "", /Online-mapped campus/);
  assert.match(mapped.locationNotes ?? "", /entrance not verified/);
  assert.equal(mapped.sourceLinks.length, 1);
  const candidate = toPublicCenter({ ...validCenter, latitude: null, longitude: null,
    sourceSnapshot: { record: { coordinate_candidate: { latitude: 14.9, longitude: 120.8 } } } });
  assert.equal(candidate.latitude, null);
  assert.equal(candidate.longitude, null);
});

test("new operational confirmations require a timestamp and their own evidence", () => {
  const base = { confirmAvailability: true, operationalConfirmedAt: recent.toISOString() };
  assert.match(parseOperationalConfirmation({}, "available").error ?? "", /Confirm/);
  assert.match(parseOperationalConfirmation({ ...base }, "available").error ?? "", /announcement URL|direct confirmation/);
  assert.match(parseOperationalConfirmation({ ...base, operationalEvidenceUrl: "http://example.com" }, "available").error ?? "", /HTTPS/);
  assert.match(parseOperationalConfirmation({ ...base, operationalEvidenceUrl: "https://example.gov.ph/current" }, "available").error ?? "", /^$/);
  assert.ok(parseOperationalConfirmation({ ...base, directConfirmationNote: "Spoke with MDRRMO duty officer by phone." }, "available").confirmedAt);
  assert.match(parseOperationalConfirmation({ ...base, operationalConfirmedAt: new Date(Date.now() + 60_000).toISOString(), directConfirmationNote: "Spoke with MDRRMO duty officer by phone." }, "available").error ?? "", /future/);
  assert.equal(parseOperationalConfirmation({}, "available", "available").confirmedAt, undefined);
});

test("a sourced facility without coordinates stays public but has no invented map point", () => {
  const center = { ...validCenter, latitude: null, longitude: null,
    verificationStatus: "official_publication_found", sourceCheckedAt: recent,
    status: "needs_verification", availabilityConfirmedAt: null };
  assert.equal(isPublishableCenter(center), true);
  const publicCenter = toPublicCenter(center);
  assert.equal(publicCenter.latitude, null);
  assert.equal(publicCenter.longitude, null);
  assert.equal(publicCenter.availability, "unknown");
  assert.equal(publicCenter.status, "needs_verification");
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
