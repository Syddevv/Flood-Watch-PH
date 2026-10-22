import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { hashSessionToken } from "@/lib/auth-session-token";
import { integrationTest, startTestServer, stopServer, testDatabaseUrl } from "./test-server";

integrationTest("admin directory and manual coordination preserve public privacy and request state", async () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl! }) });
  const adminId = randomUUID();
  const citizenId = randomUUID();
  const requestId = randomUUID();
  const orgIds: string[] = [];
  let server: Awaited<ReturnType<typeof startTestServer>> | undefined;
  try {
    for (const [id, role] of [[adminId, "admin"], [citizenId, "user"]] as const) {
      await db.user.create({ data: { id, email: `phase2-${id}@example.com`, passwordHash: "unused", role, emailVerificationStatus: "verified", emailVerifiedAt: new Date() } });
      await db.session.create({ data: { userId: id, tokenHash: hashSessionToken(id), expiresAt: new Date(Date.now() + 120_000) } });
    }
    await db.rescueRequest.create({ data: { id: requestId, reference: `RR-${requestId}`, requesterUserId: citizenId, creatorUserId: citizenId, intakeChannel: "public", idempotencyKey: requestId, idempotencyHash: "phase2", forWhom: "self", primaryContact: "test-only", peopleCount: 1, description: "Test-only rescue request", locationName: "Calumpit", locationUncertainty: "manual", localityCode: "0301407000", barangay: "Meysulao", status: "triaged" } });
    server = await startTestServer();
    const { baseUrl } = server;
    const admin = { Cookie: `floodwatch_auth_session=${adminId}`, Origin: baseUrl, "Content-Type": "application/json" };
    const citizen = { Cookie: `floodwatch_auth_session=${citizenId}`, Origin: baseUrl, "Content-Type": "application/json" };
    const send = (path: string, method: string, body: unknown, headers = admin) => fetch(`${baseUrl}${path}`, { method, headers, body: JSON.stringify(body) });
    assert.equal((await fetch(`${baseUrl}/api/admin/responders`, { headers: citizen })).status, 403);
    assert.equal((await fetch(`${baseUrl}/api/admin/responders`)).status, 401);
    assert.equal((await send("/api/admin/responders", "POST", { name: "Invalid", type: "office", homeLocalityCode: "outside", coverageLocalityCodes: ["outside"] })).status, 400);
    const organization = { name: "Demo rescue desk", type: "municipal_office", homeLocalityCode: "0301407000", coverageLocalityCodes: ["0301407000"], capabilityCodes: ["boat"], demo: true };
    const first = await send("/api/admin/responders", "POST", organization);
    assert.equal(first.status, 201);
    const firstId = (await first.json()).data.id as string;
    orgIds.push(firstId);
    const second = await send("/api/admin/responders", "POST", { ...organization, name: "Second demo rescue desk" });
    assert.equal(second.status, 201);
    const secondId = (await second.json()).data.id as string;
    orgIds.push(secondId);
    assert.equal((await send(`/api/admin/responders/${firstId}`, "PATCH", { availability: "available" })).status, 400);
    assert.equal((await send(`/api/admin/responders/${firstId}`, "PATCH", { availability: "available", contactVerified: true })).status, 400);
    assert.equal((await send(`/api/admin/responders/${firstId}`, "PATCH", { availability: "available", contactVerified: true, officialPhone: "test-only-phone" })).status, 200);
    const list = await fetch(`${baseUrl}/api/admin/responders?locality=0301407000&capability=boat&availability=available`, { headers: admin });
    assert.equal(list.status, 200);
    assert.deepEqual((await list.json()).data.organizations.map((row: { id: string }) => row.id), [firstId]);
    const path = `/api/admin/rescue-requests/${requestId}/coordination`;
    assert.equal((await send(path, "POST", { action: "select", expectedVersion: 1, organizationId: firstId }, citizen)).status, 403);
    assert.equal((await send(path, "POST", { action: "select", expectedVersion: 1, organizationId: secondId })).status, 400);
    assert.equal((await send(path, "POST", { action: "select", expectedVersion: 1, organizationId: firstId })).status, 200);
    assert.equal((await send(path, "POST", { action: "select", expectedVersion: 1, organizationId: firstId })).status, 409);
    assert.equal((await db.rescueRequest.findUniqueOrThrow({ where: { id: requestId } })).status, "triaged");
    assert.equal((await send(path, "POST", { action: "contact", expectedVersion: 2, channel: "phone", note: "Admin manually called test contact." })).status, 200);
    assert.equal((await send(path, "POST", { action: "contact", expectedVersion: 2, channel: "phone", note: "Duplicate contact attempt." })).status, 409);
    assert.equal((await send(path, "POST", { action: "acknowledge", expectedVersion: 3, outcome: "declined", note: "Admin recorded a declined response." })).status, 200);
    assert.equal((await db.rescueAssignment.count({ where: { requestId, endedAt: null } })), 0);
    assert.equal((await send(path, "POST", { action: "select", expectedVersion: 4, organizationId: secondId, reason: "Availability is unknown; review needed." })).status, 200);
    assert.equal((await send(path, "POST", { action: "contact", expectedVersion: 5, channel: "phone", note: "Admin attempted a manual call." })).status, 400);
    assert.equal((await send(`/api/admin/responders/${secondId}`, "PATCH", { officialPhone: "test-only-second-phone" })).status, 200);
    assert.equal((await send(path, "POST", { action: "contact", expectedVersion: 5, channel: "phone", note: "Admin attempted a manual call." })).status, 200);
    assert.equal((await send(path, "POST", { action: "acknowledge", expectedVersion: 6, outcome: "accepted", note: "Admin recorded acceptance; not responder authenticated." })).status, 200);
    const owner = await fetch(`${baseUrl}/api/rescue-requests/${requestId}`, { headers: citizen });
    assert.equal(owner.status, 200);
    const publicText = await owner.text();
    assert.doesNotMatch(publicText, /assignments|organization_selected|contact_attempt_recorded|contact_outcome_recorded|test-only-phone|Admin manually called/);
    assert.equal(JSON.parse(publicText).data.status, "triaged");
    const detail = await fetch(`${baseUrl}/api/admin/rescue-requests/${requestId}`, { headers: admin });
    assert.equal(detail.status, 200);
    assert.equal((await detail.json()).data.assignments.length, 2);
    assert.equal((await db.rescueRequestEvent.count({ where: { requestId, visibility: "internal" } })), 6);
  } finally {
    if (server) await stopServer(server.server);
    await db.rescueRequestEvent.deleteMany({ where: { requestId } });
    await db.rescueAssignment.deleteMany({ where: { requestId } });
    await db.rescueRequest.deleteMany({ where: { id: requestId } });
    await db.responderOrganization.deleteMany({ where: { id: { in: orgIds } } });
    await db.session.deleteMany({ where: { userId: { in: [adminId, citizenId] } } });
    await db.user.deleteMany({ where: { id: { in: [adminId, citizenId] } } });
    await db.$disconnect();
  }
});
