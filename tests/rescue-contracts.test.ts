import assert from "node:assert/strict";
import test from "node:test";
import { canTransitionRescue, parseRescueIntake, parseRescueCorrection, parseRescueAction, parseRescueLifecycleAction, RESCUE_TRANSITIONS, TERMINAL_RESCUE_STATUSES } from "@/lib/rescue-contracts";
import { toRescueDto } from "@/lib/rescue-dto";
import type { RescueRequest, RescueRequestEvent } from "@prisma/client";

const valid = {
  forWhom: "self", primaryContact: "09171234567", peopleCount: 2,
  vulnerabilityTags: ["children"], description: "Water is rising",
  locationName: "Meysulao, Calumpit", latitude: 14.916, longitude: 120.766,
  locationUncertainty: "gps", localityCode: "0301407000", barangay: "Meysulao",
};

test("rescue lifecycle rejects every unsupported or terminal transition", () => {
  for (const [from, allowed] of Object.entries(RESCUE_TRANSITIONS)) {
    for (const to of Object.keys(RESCUE_TRANSITIONS)) assert.equal(canTransitionRescue(from, to), allowed.includes(to as never), `${from} → ${to}`);
  }
  assert.equal(canTransitionRescue("unknown", "received"), false);
  assert.equal(canTransitionRescue("assigned", "en_route"), false);
  assert.equal(canTransitionRescue("awaiting_responder", "dispatched"), false);
  assert.equal(canTransitionRescue("responder_confirmed", "dispatched"), true);
  assert.equal(canTransitionRescue("resolved", "closed"), true);
  for (const status of TERMINAL_RESCUE_STATUSES) assert.deepEqual(RESCUE_TRANSITIONS[status as keyof typeof RESCUE_TRANSITIONS], []);
});

test("lifecycle actions require a replay key and allowlisted evidence", () => {
  const validAction = { action: "lifecycle", expectedVersion: 3, actionKey: "phase3-action-key-123", nextStatus: "dispatched", dispatchMethod: "phone" };
  assert.equal(parseRescueLifecycleAction(validAction).dispatchMethod, "phone");
  assert.throws(() => parseRescueLifecycleAction({ ...validAction, actionKey: "short" }), /action key/);
  assert.throws(() => parseRescueLifecycleAction({ ...validAction, nextStatus: "teleported" }), /status/);
  assert.throws(() => parseRescueLifecycleAction({ ...validAction, dispatchMethod: "automated_sms" }), /dispatch method/);
  assert.throws(() => parseRescueLifecycleAction({ ...validAction, spoofedActorId: "admin" }), /fields/);
  assert.throws(() => parseRescueLifecycleAction({ ...validAction, occurredAt: "tomorrow" }), /occurrence time/);
});

test("intake accepts a manual Bulacan place and rejects outside GPS", () => {
  assert.equal(parseRescueIntake({ ...valid, latitude: null, longitude: null, locationUncertainty: "manual" }).latitude, null);
  assert.throws(() => parseRescueIntake({ ...valid, latitude: 14.6507, longitude: 121.1029 }), /within Bulacan/);
  assert.throws(() => parseRescueIntake({ ...valid, localityCode: "invalid" }), /Bulacan/);
  assert.throws(() => parseRescueIntake({ ...valid, peopleCount: 0 }), /people count/);
});

test("assisted intake method and initial priority are allowlisted", () => {
  const parsed = parseRescueIntake({ ...valid, assistedIntakeMethod: "phone", priority: "urgent" });
  assert.equal(parsed.assistedIntakeMethod, "phone");
  assert.equal(parsed.priority, "urgent");
  assert.equal(parseRescueIntake(valid).priority, "routine");
  assert.throws(() => parseRescueIntake({ ...valid, assistedIntakeMethod: "unknown" }), /intake method/);
  assert.throws(() => parseRescueIntake({ ...valid, priority: "immediate" }), /initial priority/);
});

test("requester corrections are allowlisted and versioned", () => {
  assert.deepEqual(parseRescueCorrection({ expectedVersion: 3, action: "cancel" }), { expectedVersion: 3, action: "cancel" });
  assert.throws(() => parseRescueCorrection({ expectedVersion: 3, status: "completed" }), /Only contact/);
  assert.throws(() => parseRescueCorrection({ expectedVersion: 0, description: "New" }), /Expected version/);
  assert.equal(parseRescueCorrection({ expectedVersion: 2, description: "New place" }).action, "correct");
});

test("admin actions require a version and action-specific details", () => {
  assert.throws(() => parseRescueAction({ expectedVersion: 1, action: "assign" }), /Required action/);
  assert.throws(() => parseRescueAction({ expectedVersion: 1, action: "priority", priority: "immediate" }), /Invalid rescue action/);
  assert.equal(parseRescueAction({ expectedVersion: 1, action: "transition", nextStatus: "triaged" }).nextStatus, "triaged");
});

test("public DTO hides internal events, actors, assignment and private admin notes", () => {
  const record = {
    id: "r1", reference: "RR-123", status: "triaged", priority: "urgent", version: 2,
    createdAt: new Date(), updatedAt: new Date(), forWhom: "self", assistedPersonName: null,
    relationship: null, primaryContact: "0917", alternateContact: null, peopleCount: 1,
    vulnerabilityTags: [], vulnerabilityNotes: null, description: "Flood", locationName: "Calumpit",
    latitude: null, longitude: null, locationUncertainty: "manual", localityCode: "0301407000",
    barangay: "Meysulao", linkedReportId: null, linkedReportConsentConfirmedAt: null, caseOwnerUserId: "admin1",
    confirmedTeamReference: null, outcome: null, requesterUserId: "user1", creatorUserId: "user1",
    intakeChannel: "admin_assisted", assistedIntakeMethod: "phone", events: [
      { id: "e1", eventType: "triage", visibility: "public", reason: "private", note: null, actorUserId: "admin1", createdAt: new Date() },
      { id: "e2", eventType: "note", visibility: "internal", reason: null, note: "phone number", actorUserId: "admin1", createdAt: new Date() },
      { id: "e3", eventType: "note", visibility: "public", reason: null, note: "Operator is reviewing this request", actorUserId: "admin1", createdAt: new Date() },
    ],
  } as unknown as RescueRequest & { events: RescueRequestEvent[] };
  const dto = toRescueDto(record);
  assert.equal(dto.events?.length, 2);
  assert.equal(dto.events?.[0].note, null);
  assert.equal(dto.events?.[1].note, "Operator is reviewing this request");
  assert.equal(dto.events?.[0].reason, null);
  assert.equal(dto.caseOwnerUserId, undefined);
  assert.equal(dto.requesterUserId, undefined);
  assert.equal(dto.assistedIntakeMethod, undefined);
  assert.equal(toRescueDto(record, true).assistedIntakeMethod, "phone");
  assert.equal(toRescueDto(record, true).events?.length, 3);
});
