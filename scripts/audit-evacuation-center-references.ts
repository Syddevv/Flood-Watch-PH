import dataset from "../data/bulacan-emergency-directory.json";
import { EVACUATION_CENTERS } from "../data/evacuation-centers";
import { BULACAN_LOCALITIES } from "../data/bulacan-localities";
import { canonicalDirectoryMunicipality, validateBulacanDirectory } from "../lib/bulacan-directory";
import { isWithinBulacan } from "../lib/bulacan-scope";
import { findCenterImportMatch } from "../lib/center-import-policy";

const directory = validateBulacanDirectory(dataset);
const references = EVACUATION_CENTERS.map((row) => ({
  id: row.id, externalKey: null, name: row.name, address: row.address,
  city: row.city, province: row.province, latitude: row.latitude, longitude: row.longitude,
  sourceType: row.sourceType, updatedByUserId: null, isArchived: false,
}));
const overlapCandidates = directory.evacuation_centers.flatMap((record) => {
  const match = findCenterImportMatch(references, {
    id: record.id, name: record.name, address: record.address, city: record.municipality,
  });
  return match.kind === "name_location" ? [{ sourceId: record.id, referenceIds: [match.row.id], match: "name_location" }]
    : match.kind === "review" ? [{ sourceId: record.id, referenceIds: match.ids, match: "name_only_review" }] : [];
});
const sourcedLocalities = new Set(directory.evacuation_centers.map((row) => canonicalDirectoryMunicipality(row.municipality)));

console.log(JSON.stringify({
  sourceDataset: directory.dataset_id,
  sourceReferenceCount: directory.sources.length,
  sourcedCenters: directory.evacuation_centers.length,
  sourcedLocalities: sourcedLocalities.size,
  localitiesWithoutSourcedCenters: BULACAN_LOCALITIES.filter((row) => !sourcedLocalities.has(row.name)).map((row) => row.name),
  staticReferenceCount: references.length,
  staticOutsideBulacan: references.filter((row) => !isWithinBulacan(row.latitude, row.longitude)).map((row) => row.id),
  staticUnverifiedCount: references.filter((row) => row.sourceType === "community_reference").length,
  overlapCandidates,
  policy: "Static references are never promoted to verified centers. Review name-only matches before importing sourced records.",
}, null, 2));
