import assert from "node:assert/strict";
import test from "node:test";
import { findCenterImportMatch, legacyCenterQuarantineReason, type ImportCenterRow } from "@/lib/center-import-policy";

const row: ImportCenterRow = {
  id: "legacy", externalKey: null, name: "Malolos Sport Convention Center",
  address: "New City Hall of Malolos, Bulihan", city: "Malolos City", province: "Bulacan",
  latitude: 14.86, longitude: 120.81, sourceType: "community_reference",
  updatedByUserId: null, isArchived: false,
};

test("center import matches stable keys and exact legacy names plus locations", () => {
  const candidate = { id: "official-id", name: "Malolos Sports Convention Center", address: row.address, city: "City of Malolos" };
  assert.equal(findCenterImportMatch([row], candidate).kind, "name_location");
  assert.deepEqual(findCenterImportMatch([{ ...row, externalKey: candidate.id }], candidate).kind, "source_key");
  assert.deepEqual(findCenterImportMatch([row], { ...candidate, address: "Other site" }), { kind: "review", ids: [row.id] });
  assert.deepEqual(findCenterImportMatch([{ ...row, externalKey: "other-source" }], candidate), { kind: "review", ids: [row.id] });
  assert.deepEqual(findCenterImportMatch([row], { ...candidate, name: "Another school" }), { kind: "new" });
});

test("quarantine only unedited demo or outside rows", () => {
  assert.equal(legacyCenterQuarantineReason({ ...row, name: "Gymnasium Reference" }), "demo_reference");
  assert.equal(legacyCenterQuarantineReason({ ...row, province: "Pampanga" }), "outside_bulacan");
  assert.equal(legacyCenterQuarantineReason({ ...row, updatedByUserId: "admin", province: "Pampanga" }), null);
  assert.equal(legacyCenterQuarantineReason({ ...row, sourceType: "official_lgu", name: "Gymnasium Reference" }), null);
});
