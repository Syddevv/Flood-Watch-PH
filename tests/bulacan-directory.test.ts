import assert from "node:assert/strict";
import test from "node:test";

import dataset from "../data/bulacan-emergency-directory.json";
import { BULACAN_LOCALITIES } from "../data/bulacan-localities";
import { canonicalDirectoryMunicipality, sourceRefreshData, validateBulacanDirectory } from "../lib/bulacan-directory";

test("directory validates every source, record, and Bulacan LGU without inventing locations", () => {
  const directory = validateBulacanDirectory(dataset);
  assert.equal(directory.evacuation_centers.length, 43);
  assert.equal(directory.emergency_contacts.length, 81);
  assert.equal(directory.sources.length, 24);
  assert.equal(directory.coverage_by_municipality.length, BULACAN_LOCALITIES.length);
  assert.equal(new Set(directory.coverage_by_municipality.map((row) => canonicalDirectoryMunicipality(row.municipality))).size, BULACAN_LOCALITIES.length);
  assert.equal(directory.evacuation_centers.filter((center) => center.latitude !== null).length, 10);
  assert.equal(directory.evacuation_centers.filter((center) => center.latitude === null && center.longitude === null).length, 33);
  assert.ok(directory.evacuation_centers.every((center) => center.operational_status === "unknown" && center.current_occupancy === null && center.current_available_spaces === null));
  assert.ok(directory.emergency_contacts.every((contact) => contact.operational_status === "unknown" && !contact.call_tested));
  assert.equal(directory.emergency_contacts.flatMap((contact) => contact.phones).length, 97);
  assert.ok(directory.excluded_or_unresolved.length > 0);
  const importedIds = new Set([...directory.evacuation_centers, ...directory.emergency_contacts].map((record) => record.id));
  assert.ok(directory.excluded_or_unresolved.every((record) => !importedIds.has(record.name)));
});

test("directory rejects missing source references, repeated IDs, invalid coordinates, and impossible dates", () => {
  const changed = structuredClone(dataset);
  changed.evacuation_centers[0].source_ids = ["missing-source"];
  assert.throws(() => validateBulacanDirectory(changed), /Unknown source/);
  const repeated = structuredClone(dataset);
  repeated.emergency_contacts[1].id = repeated.emergency_contacts[0].id;
  assert.throws(() => validateBulacanDirectory(repeated), /repeated contact ID/);
  const invalidLocation = structuredClone(dataset);
  invalidLocation.evacuation_centers[0].latitude = 0;
  assert.throws(() => validateBulacanDirectory(invalidLocation), /Invalid facility/);
  const badDate = structuredClone(dataset);
  badDate.sources[0].checked_at = "2026-02-31";
  assert.throws(() => validateBulacanDirectory(badDate), /Invalid source/);
});

test("refreshes source evidence but preserves corrected admin fields", () => {
  const values = { name: "Original source", city: "Angat" };
  const snapshot = { record: { name: "New source" } };
  assert.deepEqual(sourceRefreshData(null, values, snapshot), { ...values, sourceSnapshot: snapshot });
  assert.deepEqual(sourceRefreshData("admin-id", values, snapshot), { sourceSnapshot: snapshot });
});
