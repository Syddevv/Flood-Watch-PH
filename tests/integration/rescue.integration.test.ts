import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { hashSessionToken } from "@/lib/auth-session-token";
import { integrationTest, startTestServer, stopServer, testDatabaseUrl } from "./test-server";

integrationTest("rescue intake, idempotency, ownership, CAS and admin timeline", async () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl! }) });
  const ids = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  const cookies = ids.map((id) => `floodwatch_auth_session=${id}`);
  const runId = randomUUID();
  let server: Awaited<ReturnType<typeof startTestServer>> | undefined;
  let requestId: string | undefined;
  let adminRequestId: string | undefined;
  let legacyAdminRequestId: string | undefined;
  let organizationId: string | undefined;
  try {
    for (const [index, id] of ids.entries()) {
      await db.user.create({ data: { id, email: `rescue-${index}-${runId}@example.com`, passwordHash: "unused", role: index >= 2 ? "admin" : "user", emailVerificationStatus: "verified", emailVerifiedAt: new Date() } });
      await db.session.create({ data: { userId: id, tokenHash: hashSessionToken(id), expiresAt: new Date(Date.now() + 60_000) } });
    }
    server = await startTestServer();
    const { baseUrl } = server;
    const intake = { forWhom: "self", primaryContact: "09171234567", peopleCount: 2, vulnerabilityTags: ["children"], description: "Water rising", locationName: "Meysulao, Calumpit", latitude: null, longitude: null, locationUncertainty: "manual", localityCode: "0301407000", barangay: "Meysulao" };
    const post = (body: unknown, key: string) => fetch(`${baseUrl}/api/rescue-requests`, { method: "POST", headers: { Origin: baseUrl, Cookie: cookies[0], "Content-Type": "application/json", "Idempotency-Key": key }, body: JSON.stringify(body) });
    const key = randomUUID();
    const first = await post(intake, key);
    assert.equal(first.status, 201);
    const firstBody = await first.json();
    requestId = firstBody.data.request.id;
    assert.match(firstBody.data.request.reference, /^RR-/);
    const replay = await post(intake, key);
    assert.equal(replay.status, 200);
    assert.equal((await replay.json()).data.request.id, requestId);
    assert.equal((await post({ ...intake, description: "Different" }, key)).status, 409);
    assert.equal(await db.rescueRequest.count({ where: { id: requestId } }), 1);
    assert.equal(await db.rescueRequestEvent.count({ where: { requestId } }), 1);
    assert.equal(await db.adminNotification.count({ where: { targetId: requestId } }), 2);
    const notices = await fetch(`${baseUrl}/api/admin/notifications`, { headers: { Cookie: cookies[2] } });
    assert.equal(notices.status, 200);
    const noticeBody = await notices.json();
    assert.equal(noticeBody.data.unreadCount, 1);
    const noticeId = noticeBody.data.notifications[0].id;
    const markedRead = await fetch(`${baseUrl}/api/admin/notifications`, { method: "PATCH", headers: { Cookie: cookies[2], Origin: baseUrl, "Content-Type": "application/json" }, body: JSON.stringify({ id: noticeId }) });
    assert.equal(markedRead.status, 200);
    assert.equal((await markedRead.json()).data.unreadCount, 0);
    const queue = await fetch(`${baseUrl}/api/admin/rescue-requests?status=received&priority=routine&search=Meysulao`, { headers: { Cookie: cookies[2] } });
    assert.equal(queue.status, 200);
    const queueBody = await queue.json();
    assert.equal(queueBody.data.requests.some((item: { id: string }) => item.id === requestId), true);
    assert.equal(queueBody.data.requests.some((item: { primaryContact?: string }) => "primaryContact" in item), false);
    assert.equal(queueBody.data.summary.total >= 1, true);
    const exported = await fetch(`${baseUrl}/api/admin/rescue-requests/export?search=${encodeURIComponent(firstBody.data.request.reference)}`, { headers: { Cookie: cookies[2] } });
    assert.equal(exported.status, 200);
    const csv = await exported.text();
    assert.match(csv, /Reference,Received at,Status/);
    assert.doesNotMatch(csv, /09171234567|Water rising|14\.916/);
    assert.equal((await fetch(`${baseUrl}/api/admin/rescue-requests/export`, { headers: { Cookie: cookies[0] } })).status, 403);

    const ownerRead = await fetch(`${baseUrl}/api/rescue-requests/${requestId}`, { headers: { Cookie: cookies[0] } });
    assert.equal(ownerRead.status, 200);
    const ownerPayload = (await ownerRead.json()).data;
    assert.equal(ownerPayload.events.length, 1);
    assert.equal("assignments" in ownerPayload, false);
    assert.equal("organization" in ownerPayload, false);
    const otherRead = await fetch(`${baseUrl}/api/rescue-requests/${requestId}`, { headers: { Cookie: cookies[1] } });
    assert.equal(otherRead.status, 404);
    const adminRead = await fetch(`${baseUrl}/api/admin/rescue-requests/${requestId}`, { headers: { Cookie: cookies[2] } });
    assert.equal(adminRead.status, 200);

    const correction = (body: unknown) => fetch(`${baseUrl}/api/rescue-requests/${requestId}`, { method: "PATCH", headers: { Origin: baseUrl, Cookie: cookies[0], "Content-Type": "application/json" }, body: JSON.stringify(body) });
    assert.equal((await correction({ expectedVersion: 1, description: "Water rising at our door" })).status, 200);
    assert.equal((await correction({ expectedVersion: 1, description: "Stale correction" })).status, 409);
    const otherCorrection = await fetch(`${baseUrl}/api/rescue-requests/${requestId}`, { method: "PATCH", headers: { Origin: baseUrl, Cookie: cookies[1], "Content-Type": "application/json" }, body: JSON.stringify({ expectedVersion: 2, description: "Unauthorized" }) });
    assert.equal(otherCorrection.status, 404);

    const action = (body: unknown) => fetch(`${baseUrl}/api/admin/rescue-requests/${requestId}/actions`, { method: "POST", headers: { Origin: baseUrl, Cookie: cookies[2], "Content-Type": "application/json" }, body: JSON.stringify(body) });
    assert.equal((await fetch(`${baseUrl}/api/admin/rescue-requests/${requestId}/actions`, { method: "POST", headers: { Origin: baseUrl, Cookie: cookies[0], "Content-Type": "application/json" }, body: JSON.stringify({ expectedVersion: 2, action: "lifecycle", actionKey: randomUUID(), nextStatus: "under_review" }) })).status, 403);
    assert.equal((await action({ expectedVersion: 2, action: "transition", nextStatus: "en_route" })).status, 400);
    assert.equal((await action({ expectedVersion: 2, action: "lifecycle", actionKey: randomUUID(), nextStatus: "under_review" })).status, 200);
    assert.equal((await action({ expectedVersion: 1, action: "priority", priority: "critical" })).status, 409);
    const competingAction = await fetch(`${baseUrl}/api/admin/rescue-requests/${requestId}/actions`, { method: "POST", headers: { Origin: baseUrl, Cookie: cookies[3], "Content-Type": "application/json" }, body: JSON.stringify({ expectedVersion: 2, action: "priority", priority: "critical" }) });
    assert.equal(competingAction.status, 409);
    assert.equal((await action({ expectedVersion: 3, action: "assign", caseOwnerUserId: ids[2] })).status, 200);
    assert.equal((await action({ expectedVersion: 4, action: "lifecycle", actionKey: randomUUID(), nextStatus: "awaiting_responder", note: "Two people need boat transport." })).status, 200);
    assert.equal((await action({ expectedVersion: 5, action: "transition", nextStatus: "en_route", confirmedTeamReference: "unverified" })).status, 400);
    assert.equal((await action({ expectedVersion: 5, action: "lifecycle", actionKey: randomUUID(), nextStatus: "dispatched", dispatchMethod: "phone" })).status, 400);
    const organization = await db.responderOrganization.create({ data: { name: `Test rescue unit ${runId}`, type: "municipal_office", homeLocalityCode: "0301407000", coverageLocalityCodes: ["0301407000"], officialPhone: "test-only-phone", availability: "available", lastContactVerifiedAt: new Date(), demo: true } });
    organizationId = organization.id;
    const coordinate = (body: unknown) => fetch(`${baseUrl}/api/admin/rescue-requests/${requestId}/coordination`, { method: "POST", headers: { Origin: baseUrl, Cookie: cookies[2], "Content-Type": "application/json" }, body: JSON.stringify(body) });
    assert.equal((await coordinate({ expectedVersion: 5, action: "select", organizationId })).status, 200);
    assert.equal((await coordinate({ expectedVersion: 6, action: "contact", channel: "phone", note: "Called the recorded office number." })).status, 200);
    assert.equal((await coordinate({ expectedVersion: 7, action: "acknowledge", outcome: "accepted", note: "Acceptance recorded from the call." })).status, 200);
    assert.equal((await action({ expectedVersion: 8, action: "lifecycle", actionKey: randomUUID(), nextStatus: "responder_confirmed" })).status, 200);
    const dispatchKey = randomUUID();
    const dispatchAction = { expectedVersion: 9, action: "lifecycle", actionKey: dispatchKey, nextStatus: "dispatched", dispatchMethod: "phone" };
    assert.equal((await action(dispatchAction)).status, 200);
    assert.equal((await action(dispatchAction)).status, 200);
    assert.equal(await db.rescueRequestEvent.count({ where: { requestId, actionKey: dispatchKey } }), 1);
    assert.equal((await action({ ...dispatchAction, dispatchMethod: "radio" })).status, 409);
    assert.equal((await action({ expectedVersion: 10, action: "lifecycle", actionKey: randomUUID(), nextStatus: "en_route" })).status, 200);
    assert.equal((await action({ expectedVersion: 11, action: "lifecycle", actionKey: randomUUID(), nextStatus: "on_scene", occurredAt: "2020-01-01T00:00:00.000Z" })).status, 400);
    assert.equal((await correction({ expectedVersion: 11, action: "cancel" })).status, 200);
    const updated = await fetch(`${baseUrl}/api/rescue-requests/${requestId}`, { headers: { Cookie: cookies[0] } });
    assert.equal((await updated.json()).data.status, "en_route");
    assert.equal((await db.rescueRequest.findUnique({ where: { id: requestId } }))?.version, 12);
    assert.equal((await action({ expectedVersion: 12, action: "note", note: "Private caller details", visibility: "internal" })).status, 200);
    assert.equal((await action({ expectedVersion: 13, action: "note", note: "Operator is reviewing your request", visibility: "public" })).status, 200);
    const ownerTimeline = await fetch(`${baseUrl}/api/rescue-requests/${requestId}`, { headers: { Cookie: cookies[0] } });
    const ownerEvents = (await ownerTimeline.json()).data.events;
    assert.equal(ownerEvents.some((event: { note: string | null }) => event.note === "Private caller details"), false);
    assert.equal(ownerEvents.some((event: { note: string | null }) => event.note === "Operator is reviewing your request"), true);
    assert.equal((await action({ expectedVersion: 14, action: "lifecycle", actionKey: randomUUID(), nextStatus: "on_scene" })).status, 200);
    assert.equal((await action({ expectedVersion: 15, action: "lifecycle", actionKey: randomUUID(), nextStatus: "resolved", outcomeCode: "rescued", outcome: "Resident moved to agreed safe pickup point", occurredAt: new Date().toISOString() })).status, 200);
    assert.equal((await action({ expectedVersion: 16, action: "lifecycle", actionKey: randomUUID(), nextStatus: "closed", reason: "Final case documentation was reviewed." })).status, 200);
    assert.equal((await action({ expectedVersion: 17, action: "priority", priority: "urgent" })).status, 400);

    const assisted = { ...intake, intakeChannel: "admin_assisted", assistedIntakeMethod: "walk_in", priority: "critical", forWhom: "other", assistedPersonName: "Resident", relationship: "Neighbor" };
    const assistedKey = randomUUID();
    const assistedPost = (cookie: string) => fetch(`${baseUrl}/api/admin/rescue-requests`, { method: "POST", headers: { Origin: baseUrl, Cookie: cookie, "Content-Type": "application/json", "Idempotency-Key": assistedKey }, body: JSON.stringify(assisted) });
    assert.equal((await assistedPost(cookies[0])).status, 403);
    const adminIntake = await assistedPost(cookies[2]);
    assert.equal(adminIntake.status, 201, server.output.join("").slice(-2000));
    const adminBody = await adminIntake.json();
    adminRequestId = adminBody.data.request.id;
    assert.equal(adminBody.data.request.priority, "critical");
    assert.equal(adminBody.data.request.assistedIntakeMethod, "walk_in");
    assert.equal((await assistedPost(cookies[2])).status, 200);
    const stored = await db.rescueRequest.findUniqueOrThrow({ where: { id: adminRequestId } });
    assert.equal(stored.creatorUserId, ids[2]);
    assert.equal(stored.requesterUserId, null);
    assert.equal(stored.intakeChannel, "admin_assisted");
    assert.equal(stored.assistedIntakeMethod, "walk_in");
    assert.equal(stored.priority, "critical");
    assert.equal(await db.rescueRequestEvent.count({ where: { requestId: adminRequestId } }), 1);
    assert.equal((await db.rescueRequestEvent.findFirst({ where: { requestId: adminRequestId } }))?.nextPriority, "critical");
    assert.equal((await post({ ...intake, priority: "critical" }, randomUUID())).status, 400);

    const legacyAdminIntake = await fetch(`${baseUrl}/api/admin/rescue-requests`, { method: "POST", headers: { Origin: baseUrl, Cookie: cookies[2], "Content-Type": "application/json", "Idempotency-Key": randomUUID() }, body: JSON.stringify({ ...intake, intakeChannel: "admin_assisted" }) });
    assert.equal(legacyAdminIntake.status, 201);
    legacyAdminRequestId = (await legacyAdminIntake.json()).data.request.id;
    const legacyStored = await db.rescueRequest.findUniqueOrThrow({ where: { id: legacyAdminRequestId } });
    assert.equal(legacyStored.assistedIntakeMethod, null);
    assert.equal(legacyStored.priority, "routine");
  } finally {
    if (server) await stopServer(server.server);
    if (requestId) {
      await db.adminNotification.deleteMany({ where: { targetId: requestId } });
      await db.rescueRequestEvent.deleteMany({ where: { requestId } });
      await db.rescueAssignment.deleteMany({ where: { requestId } });
      await db.rescueRequest.deleteMany({ where: { id: requestId } });
    }
    if (organizationId) await db.responderOrganization.deleteMany({ where: { id: organizationId } });
    if (adminRequestId) {
      await db.adminNotification.deleteMany({ where: { targetId: adminRequestId } });
      await db.rescueRequestEvent.deleteMany({ where: { requestId: adminRequestId } });
      await db.rescueRequest.deleteMany({ where: { id: adminRequestId } });
    }
    if (legacyAdminRequestId) {
      await db.adminNotification.deleteMany({ where: { targetId: legacyAdminRequestId } });
      await db.rescueRequestEvent.deleteMany({ where: { requestId: legacyAdminRequestId } });
      await db.rescueRequest.deleteMany({ where: { id: legacyAdminRequestId } });
    }
    await db.session.deleteMany({ where: { userId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  }
});
