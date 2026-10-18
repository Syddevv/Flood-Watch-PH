import assert from "node:assert/strict";
import test from "node:test";
import { emptyAdminRescueFields, serializeAdminRescueIntake } from "@/lib/admin-rescue-intake-form";

const valid = { ...emptyAdminRescueFields, primaryContact: "09171234567", description: "Water is rising at the house", locationName: "Meysulao", localityCode: "0301407000", barangay: "Meysulao" };

test("admin-assisted payload keeps method and priority separate from account identity", () => {
  const payload = serializeAdminRescueIntake({ ...valid, intakeMethod: "walk_in", priority: "critical", forWhom: "other", relationship: "Neighbor", assistedPersonName: "Resident", latitude: "14.916", longitude: "120.766" });
  assert.equal(payload.intakeChannel, "admin_assisted");
  assert.equal(payload.assistedIntakeMethod, "walk_in");
  assert.equal(payload.priority, "critical");
  assert.equal(payload.locationUncertainty, "manual");
  assert.equal(payload.relationship, "Neighbor");
  assert.equal("requesterUserId" in payload, false);
  assert.equal("creatorUserId" in payload, false);
});

test("manual location, coordinate pairs and linked-report consent are validated", () => {
  assert.equal(serializeAdminRescueIntake(valid).locationUncertainty, "manual");
  assert.throws(() => serializeAdminRescueIntake({ ...valid, latitude: "14.916" }), /both latitude/);
  assert.throws(() => serializeAdminRescueIntake({ ...valid, latitude: "14.6507", longitude: "121.1029" }), /within Bulacan/);
  assert.throws(() => serializeAdminRescueIntake({ ...valid, linkedReportId: "report-1" }), /consent/);
  assert.equal(serializeAdminRescueIntake({ ...valid, linkedReportId: "report-1", linkConsentConfirmed: true }).linkedReportId, "report-1");
});
