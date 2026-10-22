import assert from "node:assert/strict";
import test from "node:test";
import { parseAdminContactPayload } from "../lib/admin-emergency-contact";

const existing = {
  agencyName: "Bureau of Fire Protection",
  category: "fire",
  city: "City of Baliwag",
  verificationStatus: "official_publication_found",
  sourceUrl: "https://bulacan.gov.ph/government/offices/",
  lastSourceCheckedAt: "2026-10-18",
  sourceFreshness: "dated_advisory_or_agency_page",
  phones: [
    { raw: "766-3250", telUri: null },
    { raw: "0917-123-4567", telUri: "tel:+639171234567" },
  ],
  preferred: true,
  isArchived: false,
};

test("admin contact edits keep multiple numbers, dial links, source state, and preferred listing", () => {
  const result = parseAdminContactPayload(existing);
  assert.ok(result.data);
  assert.equal(result.data.contactNumber, "766-3250");
  assert.deepEqual(result.data.phones, [
    { raw: "766-3250", tel_uri: null },
    { raw: "0917-123-4567", tel_uri: "tel:+639171234567" },
  ]);
  assert.equal(result.data.verificationStatus, "official_publication_found");
  assert.equal(result.data.preferred, true);
  assert.equal(result.data.sourceUrl, existing.sourceUrl);
});

test("editing a number does not promote its verification state", () => {
  const result = parseAdminContactPayload({ ...existing, verificationStatus: "needs_verification", phones: [{ raw: "911", telUri: "tel:911" }] });
  assert.equal(result.data?.verificationStatus, "needs_verification");
  assert.equal(result.data?.contactNumber, "911");
});

test("empty extra numbers and invalid localities are rejected", () => {
  assert.ok(parseAdminContactPayload({ ...existing, phones: [...existing.phones, { raw: "", telUri: null }] }).error);
  assert.ok(parseAdminContactPayload({ ...existing, phones: [{ raw: "call me", telUri: null }] }).error);
  assert.ok(parseAdminContactPayload({ ...existing, city: "Outside Bulacan" }).error);
});
