import assert from "node:assert/strict";
import test from "node:test";

import { matchesContactGroup, resolveContactGroups } from "../lib/emergency-contact-directory";
import type { PublicEmergencyContact } from "../lib/types";

const base: PublicEmergencyContact = {
  id: "new", agencyName: "Bulacan PDRRMO / Bulacan Rescue", contactNumber: "911", callHref: "tel:911",
  phones: [{ raw: "911", telUri: "tel:911" }, { raw: "0905-333-3319", telUri: "tel:+639053333319" }],
  category: "rescue", description: null, city: null, province: "Bulacan", isNational: false,
  sourceUrl: "https://bulacan.gov.ph/emergency", lastSourceCheckedAt: "2026-10-18T00:00:00Z",
  isStale: false, sourceFreshness: "dated_advisory_or_agency_page", preferred: true,
  sourceLinks: [], sourceNotes: null, emails: [],
};

test("preferred PDRRMO listing leads one group while older numbers and evidence remain", () => {
  const older = { ...base, id: "old", agencyName: "Bulacan PDRRMO", category: "Disaster Coordination",
    phones: [{ raw: "(044) 791-0566", telUri: null }], preferred: false,
    sourceFreshness: "undated_directory", isStale: true, sourceUrl: "https://bulacan.gov.ph/old" };
  const [group] = resolveContactGroups([older, base]);
  assert.equal(group.primary.id, "new");
  assert.equal(group.records.length, 2);
  assert.deepEqual(group.numbers.map((number) => number.raw), ["911", "0905-333-3319", "(044) 791-0566"]);
  assert.equal(matchesContactGroup(group, "791-0566", "Disaster Coordination"), true);
});

test("same agency and service in one town groups, but shared numbers alone do not", () => {
  const local = { ...base, id: "local", agencyName: "Town BFP", category: "fire", city: "Angat", preferred: false };
  const newer = { ...local, id: "newer", phones: [{ raw: "0917-123-4567", telUri: "tel:+639171234567" }], preferred: true };
  const unrelated = { ...local, id: "unrelated", agencyName: "Town PNP", category: "police" };
  const groups = resolveContactGroups([local, newer, unrelated]);
  assert.equal(groups.length, 2);
  assert.equal(groups.find((group) => group.primary.id === "newer")?.records.length, 2);
  assert.equal(groups.find((group) => group.primary.id === "unrelated")?.records.length, 1);
});
