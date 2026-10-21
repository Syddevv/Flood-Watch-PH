import assert from "node:assert/strict";
import test from "node:test";
import { parseResponderOrganization } from "@/lib/rescue-dispatch-data";

const valid = {
  name: "Demo rescue office",
  type: "municipal_office",
  homeLocalityCode: "0301407000",
  coverageLocalityCodes: ["0301407000"],
  capabilityCodes: ["boat"],
  demo: true,
};

test("organization data validates Bulacan coverage and defaults to unknown availability", () => {
  const parsed = parseResponderOrganization(valid);
  assert.deepEqual(parsed.coverageLocalityCodes, ["0301407000"]);
  assert.equal(parsed.demo, true);
  assert.equal("availability" in parsed, false);
  assert.throws(() => parseResponderOrganization({ ...valid, homeLocalityCode: "outside" }));
  assert.throws(() => parseResponderOrganization({ ...valid, coverageLocalityCodes: ["0301407000", "0301407000"] }));
  assert.throws(() => parseResponderOrganization({ ...valid, coverageLocalityCodes: ["0301408000"] }));
  assert.throws(() => parseResponderOrganization({ ...valid, capabilityCodes: ["Boat!"] }));
  assert.throws(() => parseResponderOrganization({ ...valid, availability: "available" }));
});
