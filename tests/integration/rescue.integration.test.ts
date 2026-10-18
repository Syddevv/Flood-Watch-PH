import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { hashSessionToken } from "@/lib/auth-session-token";
import { integrationTest, startTestServer, stopServer, testDatabaseUrl } from "./test-server";

integrationTest("rescue intake, idempotency, ownership, CAS and admin timeline", async () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl! }) });
  const ids = [randomUUID(), randomUUID(), randomUUID()];
  const cookies = ids.map((id) => `floodwatch_auth_session=${id}`);
  const runId = randomUUID();
  let server: Awaited<ReturnType<typeof startTestServer>> | undefined;
  let requestId: string | undefined;
  try {
    for (const [index, id] of ids.entries()) {
      await db.user.create({ data: { id, email: `rescue-${index}-${runId}@example.com`, passwordHash: "unused", role: index === 2 ? "admin" : "user", emailVerificationStatus: "verified", emailVerifiedAt: new Date() } });
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

    const ownerRead = await fetch(`${baseUrl}/api/rescue-requests/${requestId}`, { headers: { Cookie: cookies[0] } });
    assert.equal(ownerRead.status, 200);
    assert.equal((await ownerRead.json()).data.events.length, 1);
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
    assert.equal((await action({ expectedVersion: 2, action: "transition", nextStatus: "en_route" })).status, 400);
    assert.equal((await action({ expectedVersion: 2, action: "transition", nextStatus: "triaged" })).status, 200);
    assert.equal((await action({ expectedVersion: 1, action: "priority", priority: "critical" })).status, 409);
    assert.equal((await action({ expectedVersion: 3, action: "assign", caseOwnerUserId: ids[2] })).status, 200);
    assert.equal((await action({ expectedVersion: 4, action: "transition", nextStatus: "en_route" })).status, 400);
    assert.equal((await action({ expectedVersion: 4, action: "transition", nextStatus: "en_route", confirmedTeamReference: "operator-confirmed-team-1" })).status, 200);
    assert.equal((await correction({ expectedVersion: 5, action: "cancel" })).status, 200);
    const updated = await fetch(`${baseUrl}/api/rescue-requests/${requestId}`, { headers: { Cookie: cookies[0] } });
    assert.equal((await updated.json()).data.status, "en_route");
    assert.equal(await db.rescueRequestEvent.count({ where: { requestId } }), 6);
    assert.equal((await db.rescueRequest.findUnique({ where: { id: requestId } }))?.version, 6);
  } finally {
    if (server) await stopServer(server.server);
    if (requestId) {
      await db.rescueRequestEvent.deleteMany({ where: { requestId } });
      await db.rescueRequest.deleteMany({ where: { id: requestId } });
    }
    await db.session.deleteMany({ where: { userId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  }
});
