import assert from "node:assert/strict";
import test from "node:test";
import { parseCoordinationAction, parseNewResponderOrganization, parseResponderOrganization } from "@/lib/rescue-dispatch-data";
import { RESPONDER_CAPABILITIES } from "@/lib/responder-options";

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

test("new organizations accept labeled capability codes and validated availability in one write", () => {
  const capabilityCodes = RESPONDER_CAPABILITIES.map((option) => option.code);
  const parsed = parseNewResponderOrganization({ ...valid, capabilityCodes, officialPhone: "test-only-number", availability: "available", contactVerified: true });
  assert.deepEqual(parsed.capabilityCodes, capabilityCodes);
  assert.equal(parsed.availability, "available");
  assert.ok(parsed.lastContactVerifiedAt instanceof Date);
  assert.throws(() => parseNewResponderOrganization({ ...valid, availability: "available" }));
  assert.throws(() => parseNewResponderOrganization({ ...valid, availability: "available", contactVerified: true }));
  assert.throws(() => parseNewResponderOrganization({ ...valid, contactVerified: true }));
  assert.throws(() => parseNewResponderOrganization({ ...valid, availability: "live" }));
  assert.throws(() => parseNewResponderOrganization({ ...valid, active: false }));
});

test("coordination actions require versions, private notes, and explicit outcomes", () => {
  assert.deepEqual(parseCoordinationAction({ action: "select", expectedVersion: 1, organizationId: "org-1" }), { action: "select", expectedVersion: 1, organizationId: "org-1", reason: undefined });
  assert.throws(() => parseCoordinationAction({ action: "select", expectedVersion: 0, organizationId: "org-1" }));
  assert.throws(() => parseCoordinationAction({ action: "reassign", expectedVersion: 2, organizationId: "org-2" }));
  assert.throws(() => parseCoordinationAction({ action: "contact", expectedVersion: 2, channel: "email", note: "Called a listed contact." }));
  assert.throws(() => parseCoordinationAction({ action: "contact", expectedVersion: 2, channel: "phone", note: "short" }));
  assert.throws(() => parseCoordinationAction({ action: "acknowledge", expectedVersion: 3, outcome: "dispatched", note: "Operator recorded a response." }));
  assert.equal(parseCoordinationAction({ action: "acknowledge", expectedVersion: 3, outcome: "declined", note: "Operator recorded a decline." }).action, "acknowledge");
});
