import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { hashSessionToken } from "@/lib/auth-session-token";
import { integrationTest, startTestServer, stopServer, testDatabaseUrl } from "./test-server";

integrationTest("admin center changes and archive state match public list, detail, and map", async () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl! }) });
  const adminId = randomUUID(), residentId = randomUUID();
  const adminToken = randomUUID(), residentToken = randomUUID();
  const name = `U6 center ${randomUUID()}`;
  let server: Awaited<ReturnType<typeof startTestServer>> | undefined;
  let centerId: string | undefined;
  try {
    for (const [id, role, token] of [[adminId, "admin", adminToken], [residentId, "user", residentToken]]) {
      await db.user.create({ data: { id, email: `center-${id}@example.com`, passwordHash: "unused", role, emailVerificationStatus: "verified", emailVerifiedAt: new Date() } });
      await db.session.create({ data: { userId: id, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + 60_000) } });
    }
    server = await startTestServer();
    const base = server.baseUrl;
    const payload = { name, address: "Meysulao, Calumpit", city: "Calumpit", localityCode: "0301407000", province: "Bulacan",
      latitude: 14.916, longitude: 120.766, barangay: "Meysulao", facilities: [], status: "needs_verification",
      verificationStatus: "official_publication_found", sourceType: "official_lgu", sourceUrl: "https://example.gov.ph/u6-center-fixture",
      sourceCheckedAt: "2026-10-01T00:00:00.000Z" };
    const adminHeaders = { Origin: base, Cookie: `floodwatch_auth_session=${adminToken}`, "Content-Type": "application/json" };
    const residentHeaders = { Origin: base, Cookie: `floodwatch_auth_session=${residentToken}`, "Content-Type": "application/json" };
    assert.equal((await fetch(`${base}/api/admin/evacuation-centers`, { method: "POST", headers: residentHeaders, body: JSON.stringify(payload) })).status, 403);
    const created = await fetch(`${base}/api/admin/evacuation-centers`, { method: "POST", headers: adminHeaders, body: JSON.stringify(payload) });
    assert.equal(created.status, 201, server.output.join("").slice(-2000));
    const center = (await created.json()).data.center as { id: string; updatedAt: string };
    centerId = center.id;
    assert.equal((await fetch(`${base}/api/admin/evacuation-centers`, { method: "POST", headers: adminHeaders, body: JSON.stringify(payload) })).status, 409);

    const publicList = await fetch(`${base}/api/evacuation-centers`);
    assert.equal(publicList.status, 200);
    assert.equal((await publicList.json()).data.centers.some((item: { id: string }) => item.id === centerId), true);
    assert.equal((await fetch(`${base}/api/evacuation-centers/${centerId}`)).status, 200);
    const map = await fetch(`${base}/api/map/all`);
    assert.equal(map.status, 200);
    assert.equal((await map.json()).evacuationCenters.some((item: { id: string }) => item.id === centerId), true);

    const changed = await fetch(`${base}/api/admin/evacuation-centers/${centerId}`, { method: "PATCH", headers: adminHeaders, body: JSON.stringify({ ...payload, name: `${name} updated`, expectedUpdatedAt: center.updatedAt }) });
    assert.equal(changed.status, 200);
    const updated = (await changed.json()).data.center as { updatedAt: string };
    assert.equal((await fetch(`${base}/api/admin/evacuation-centers/${centerId}`, { method: "PATCH", headers: adminHeaders, body: JSON.stringify({ ...payload, expectedUpdatedAt: center.updatedAt }) })).status, 409);
    const publicDetail = await fetch(`${base}/api/evacuation-centers/${centerId}`);
    assert.equal((await publicDetail.json()).data.center.name, `${name} updated`);

    const archived = await fetch(`${base}/api/admin/evacuation-centers/${centerId}/archive`, { method: "POST", headers: adminHeaders, body: JSON.stringify({ expectedUpdatedAt: updated.updatedAt }) });
    assert.equal(archived.status, 200);
    const archivedAt = (await archived.json()).data.center.updatedAt as string;
    assert.equal((await fetch(`${base}/api/evacuation-centers/${centerId}`)).status, 404);
    assert.equal((await (await fetch(`${base}/api/evacuation-centers`)).json()).data.centers.some((item: { id: string }) => item.id === centerId), false);
    assert.equal((await (await fetch(`${base}/api/map/all`)).json()).evacuationCenters.some((item: { id: string }) => item.id === centerId), false);

    const restored = await fetch(`${base}/api/admin/evacuation-centers/${centerId}/restore`, { method: "POST", headers: adminHeaders, body: JSON.stringify({ expectedUpdatedAt: archivedAt }) });
    assert.equal(restored.status, 200);
    assert.equal((await fetch(`${base}/api/evacuation-centers/${centerId}`)).status, 200);
  } finally {
    if (server) await stopServer(server.server);
    if (centerId) {
      await db.adminAuditLog.deleteMany({ where: { targetType: "EvacuationCenter", targetId: centerId } });
      await db.evacuationCenter.deleteMany({ where: { id: centerId } });
    }
    await db.session.deleteMany({ where: { userId: { in: [adminId, residentId] } } });
    await db.user.deleteMany({ where: { id: { in: [adminId, residentId] } } });
    await db.$disconnect();
  }
});
