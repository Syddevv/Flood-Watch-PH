import assert from "node:assert/strict";
import test from "node:test";
import { formatUiLabel } from "../lib/ui-labels";

test("display labels humanize internal values without changing them", () => {
  assert.equal(formatUiLabel("official_publication_found"), "Official publication found");
  assert.equal(formatUiLabel("disaster_response"), "Disaster Response");
  assert.equal(formatUiLabel("under_review"), "Under review");
  assert.equal(formatUiLabel("PWD_accessible"), "PWD accessible");
  assert.equal(formatUiLabel("Disaster Coordination"), "Disaster Coordination");
});
