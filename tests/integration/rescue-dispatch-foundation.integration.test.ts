import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { createResponderOrganization, selectResponderAssignment } from "@/lib/rescue-dispatch-data";
import { integrationTest, testDatabaseUrl } from "./test-server";

integrationTest("rescue dispatch foundation preserves legacy rows and serializes assignment selection", async () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl! }) });
  const adminId = randomUUID();
  const citizenId = randomUUID();
  const requestId = randomUUID();
  const legacyId = randomUUID();
  const orgIds: string[] = [];
  try {
    await db.user.createMany({ data: [
      { id: adminId, email: `phase1-admin-${adminId}@example.com`, passwordHash: "unused", role: "admin" },
      { id: citizenId, email: `phase1-citizen-${citizenId}@example.com`, passwordHash: "unused", role: "user" },
    ] });
    const base = {
      creatorUserId: citizenId, requesterUserId: citizenId, intakeChannel: "public",
      idempotencyHash: "test", forWhom: "self", primaryContact: "test-only",
      peopleCount: 1, description: "Test-only rescue request", locationName: "Calumpit",
      locationUncertainty: "manual", localityCode: "0301407000", barangay: "Meysulao",
    };
    await db.rescueRequest.create({ data: { ...base, id: requestId, reference: `RR-${requestId}`, idempotencyKey: requestId, status: "triaged" } });
    await db.rescueRequest.create({ data: { ...base, id: legacyId, reference: `RR-${legacyId}`, idempotencyKey: legacyId, status: "en_route", confirmedTeamReference: "legacy-team-reference" } });
    await db.rescueRequestEvent.create({ data: { requestId: legacyId, actorUserId: adminId, eventType: "transition", previousStatus: "assigned", nextStatus: "en_route", visibility: "public" } });
    const before = await db.rescueRequest.findUniqueOrThrow({ where: { id: legacyId }, include: { events: true } });
    assert.equal(before.workflowVersion, 1);
    assert.equal(before.events[0].source, null);
    await assert.rejects(selectResponderAssignment(db, adminId, legacyId, "missing", 1), { status: 400 });

    const orgData = { name: "Demo office", type: "municipal_office", homeLocalityCode: "0301407000", coverageLocalityCodes: ["0301407000"], capabilityCodes: ["boat"], demo: true };
    await assert.rejects(createResponderOrganization(db, citizenId, orgData), { status: 403 });
    const firstOrg = await createResponderOrganization(db, adminId, orgData);
    const secondOrg = await createResponderOrganization(db, adminId, { ...orgData, name: "Second demo office" });
    orgIds.push(firstOrg.id, secondOrg.id);
    assert.equal(firstOrg.availability, "unknown");
    await assert.rejects(db.responderOrganization.create({ data: { ...orgData, name: "Invalid availability", availability: "ready" } }));
    await assert.rejects(db.rescueAssignment.create({ data: { requestId: legacyId, organizationId: "missing-organization", recordedByAdminUserId: adminId } }));
    await assert.rejects(db.rescueRequestEvent.create({ data: { requestId, source: "admin", eventType: "invalid_actor", visibility: "internal" } }));

    const attempts = await Promise.allSettled([
      selectResponderAssignment(db, adminId, requestId, firstOrg.id, 1),
      selectResponderAssignment(db, adminId, requestId, secondOrg.id, 1),
    ]);
    assert.equal(attempts.filter((attempt) => attempt.status === "fulfilled").length, 1);
    assert.equal(attempts.filter((attempt) => attempt.status === "rejected").length, 1);
    assert.equal(attempts.find((attempt) => attempt.status === "rejected")?.reason.status, 409);
    assert.equal(await db.rescueAssignment.count({ where: { requestId, endedAt: null } }), 1);
    assert.equal(await db.rescueRequestEvent.count({ where: { requestId, eventType: "organization_selected" } }), 1);
    const active = await db.rescueAssignment.findFirstOrThrow({ where: { requestId, endedAt: null } });
    await assert.rejects(db.rescueAssignment.create({ data: { requestId, organizationId: active.organizationId === firstOrg.id ? secondOrg.id : firstOrg.id, recordedByAdminUserId: adminId } }));
    await assert.rejects(selectResponderAssignment(db, citizenId, requestId, firstOrg.id, 2), { status: 403 });
    await assert.rejects(selectResponderAssignment(db, adminId, requestId, firstOrg.id, 1), { status: 409 });
    await db.rescueAssignment.update({ where: { id: active.id }, data: { endedAt: new Date(), status: "ended", endReason: "Test reassignment" } });
    await selectResponderAssignment(db, adminId, requestId, active.organizationId === firstOrg.id ? secondOrg.id : firstOrg.id, 2);
    assert.equal(await db.rescueAssignment.count({ where: { requestId } }), 2);
    assert.equal(await db.rescueAssignment.count({ where: { requestId, endedAt: null } }), 1);
    const selectedEvents = await db.rescueRequestEvent.findMany({ where: { requestId, eventType: "organization_selected" }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    assert.equal(selectedEvents.length, 2);
    assert.ok(selectedEvents.every((event) => event.source === "admin" && event.visibility === "internal" && event.assignmentId));

    const after = await db.rescueRequest.findUniqueOrThrow({ where: { id: legacyId }, include: { events: true } });
    assert.equal(after.id, before.id);
    assert.equal(after.reference, before.reference);
    assert.equal(after.status, "en_route");
    assert.equal(after.confirmedTeamReference, before.confirmedTeamReference);
    assert.equal(after.events[0].id, before.events[0].id);
    assert.equal(after.workflowVersion, 1);
  } finally {
    await db.rescueRequestEvent.deleteMany({ where: { requestId: { in: [requestId, legacyId] } } });
    await db.rescueAssignment.deleteMany({ where: { requestId } });
    await db.rescueRequest.deleteMany({ where: { id: { in: [requestId, legacyId] } } });
    await db.responderOrganization.deleteMany({ where: { id: { in: orgIds } } });
    await db.user.deleteMany({ where: { id: { in: [adminId, citizenId] } } });
    await db.$disconnect();
  }
});
