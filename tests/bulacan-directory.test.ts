import assert from "node:assert/strict";
import test from "node:test";

import dataset from "../data/bulacan-emergency-directory.json";
import { BULACAN_LOCALITIES } from "../data/bulacan-localities";
import { canonicalDirectoryMunicipality, directoryLocalityCode, sourceLocationRefreshData, sourceRefreshData, validateBulacanDirectory } from "../lib/bulacan-directory";

test("directory validates every source, record, and Bulacan LGU without inventing locations", () => {
  const directory = validateBulacanDirectory(dataset);
  assert.equal(directory.evacuation_centers.length, 43);
  assert.equal(directory.emergency_contacts.length, 81);
  assert.equal(directory.sources.length, 43);
  assert.equal(directory.coverage_by_municipality.length, BULACAN_LOCALITIES.length);
  assert.equal(new Set(directory.coverage_by_municipality.map((row) => canonicalDirectoryMunicipality(row.municipality))).size, BULACAN_LOCALITIES.length);
  assert.ok(directory.evacuation_centers.every((center) => directoryLocalityCode(center.municipality)));
  assert.equal(directory.evacuation_centers.filter((center) => center.latitude !== null).length, 19);
  assert.equal(directory.evacuation_centers.filter((center) => center.latitude === null && center.longitude === null).length, 24);
  const addedLocationIds = [
    "evac-obando-obando-national-high-school", "evac-marilao-pambayang-dalubhasaan-ng-marilao-pdm",
    "evac-marilao-patubig-covered-court", "evac-bocaue-new-municipal-hall-of-bocaue",
    "evac-malolos-bulacan-capitol-gymnasium", "evac-malolos-bulacan-sports-complex",
    "evac-calumpit-san-miguel-donia-damiana-es", "evac-calumpit-sapang-bayan-bmltc-ec",
    "evac-san-ildefonso-anyatam-elementary-school",
  ];
  for (const id of addedLocationIds) {
    const center = directory.evacuation_centers.find((record) => record.id === id);
    assert.ok(center && center.latitude !== null && center.longitude !== null);
    assert.ok(center.coordinate_precision && center.location_notes && center.location_source_ids?.length);
    assert.ok(center.location_source_ids.every((sourceId) => center.source_ids.includes(sourceId)));
  }
  assert.ok(directory.evacuation_centers.filter((center) => center.coordinate_candidate).every((center) => center.latitude === null && center.longitude === null));
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
  const liveOccupancy = structuredClone(dataset);
  Object.assign(liveOccupancy.evacuation_centers[0], { current_occupancy: 10 });
  assert.throws(() => validateBulacanDirectory(liveOccupancy), /Invalid facility/);
});

test("refreshes source evidence but preserves corrected admin fields", () => {
  const values = { name: "Original source", city: "Angat" };
  const snapshot = { record: { name: "New source" } };
  assert.deepEqual(sourceRefreshData(null, values, snapshot), { ...values, sourceSnapshot: snapshot });
  assert.deepEqual(sourceRefreshData("admin-id", values, snapshot), { sourceSnapshot: snapshot });
  const location = { latitude: 14.7, longitude: 120.9, name: "Updated source name" };
  const previousSnapshot = { record: { latitude: null, longitude: null } };
  assert.deepEqual(sourceLocationRefreshData({ updatedByUserId: "admin-id", latitude: null, longitude: null, sourceSnapshot: previousSnapshot }, location, snapshot),
    { latitude: 14.7, longitude: 120.9, sourceSnapshot: snapshot });
  assert.deepEqual(sourceLocationRefreshData({ updatedByUserId: "admin-id", latitude: 14.8, longitude: 120.8, sourceSnapshot: previousSnapshot }, location, snapshot),
    { sourceSnapshot: snapshot });
  assert.deepEqual(sourceLocationRefreshData({ updatedByUserId: "admin-id", latitude: null, longitude: null, sourceSnapshot: null }, location, snapshot),
    { sourceSnapshot: snapshot });
});
