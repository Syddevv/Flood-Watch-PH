import assert from "node:assert/strict";
import test from "node:test";
import type { EmergencyContact } from "@prisma/client";

import { dedupePublicContacts, isPublishableContact, toPublicContact } from "../lib/emergency-contact-policy";

const checkedAt = new Date("2026-10-18T00:00:00Z");
const contact = {
  id: "contact-1", agencyName: "Bulacan PDRRMO", contactNumber: "0905-333-3319",
  sourceKey: "bulacan-pdrrmo-globe", sourceUrl: "https://pdrrmo.bulacan.gov.ph/contact-us/",
  lastSourceCheckedAt: checkedAt, verificationStatus: "verified", isArchived: false,
  category: "Disaster Coordination", region: "Region III", province: "Bulacan", city: null,
  description: null, isNational: false, createdAt: checkedAt, updatedAt: checkedAt,
  sourceSnapshot: null, phones: null, sourceFreshness: null, preferred: false,
  updatedByUserId: null, adminEvidenceUrl: null, notes: null, duplicateReviewNotes: null,
} satisfies EmergencyContact;

test("only sourced, dated, verified Bulacan or national contacts are public", () => {
  assert.equal(isPublishableContact(contact, checkedAt), true);
  for (const changed of [
    { isArchived: true }, { verificationStatus: "needs_verification" },
    { province: "Metro Manila" }, { sourceUrl: null },
    { sourceUrl: "http://example.com" }, { lastSourceCheckedAt: null },
    { lastSourceCheckedAt: new Date("2026-10-19") }, { contactNumber: "invalid" },
  ]) {
    assert.equal(isPublishableContact({ ...contact, ...changed }, checkedAt), false, JSON.stringify(changed));
  }
});

test("public contact omits internal fields and flags stale sources", () => {
  const result = toPublicContact(contact, new Date("2027-02-01"));
  assert.equal(result.callHref, null);
  assert.equal(result.isStale, true);
  assert.equal("sourceKey" in result, false);
  assert.equal("verificationStatus" in result, false);
});

test("deduplication normalizes local and international phone formats", () => {
  const rows = [contact, { ...contact, id: "duplicate", contactNumber: "+63 905 333 3319" }];
  assert.deepEqual(dedupePublicContacts(rows).map((row) => row.id), ["contact-1"]);
});

test("only supplied phone URIs become dial links; raw legacy numbers remain copyable", () => {
  const result = toPublicContact({ ...contact, phones: [
    { raw: "(044) 123-4567", tel_uri: null },
    { raw: "0917 123 4567", tel_uri: "tel:+639171234567" },
  ] });
  assert.deepEqual(result.phones, [
    { raw: "(044) 123-4567", telUri: null },
    { raw: "0917 123 4567", telUri: "tel:+639171234567" },
  ]);
  assert.equal(result.callHref, null);
});

test("only public source email fields are exposed", () => {
  const result = toPublicContact({ ...contact, sourceSnapshot: { record: {
    email: "help@bulacan.gov.ph", emails: ["other@bulacan.gov.ph", "not-an-email"], notes: "Public note",
  } } });
  assert.deepEqual(result.emails, ["help@bulacan.gov.ph", "other@bulacan.gov.ph"]);
  assert.equal(result.sourceNotes, "Public note");
});
