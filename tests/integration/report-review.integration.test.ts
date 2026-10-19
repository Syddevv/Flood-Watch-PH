import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { hashSessionToken } from "@/lib/auth-session-token";
import { integrationTest, startTestServer, stopServer, testDatabaseUrl } from "./test-server";

integrationTest("admin review is authorized, versioned, audited and removed from public incident views on rejection", async () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl! }) });
  const reportId = randomUUID(), incidentId = randomUUID();
  const adminIds = [randomUUID(), randomUUID()], adminTokens = [randomUUID(), randomUUID()];
  const ownerId = randomUUID(), ownerToken = randomUUID();
  const now = new Date();
  let running: Awaited<ReturnType<typeof startTestServer>> | undefined;
  try {
    for (let index = 0; index < adminIds.length; index++) {
      await db.user.create({ data: { id: adminIds[index], email: `review-${adminIds[index]}@example.com`, passwordHash: "unused", role: "admin", emailVerificationStatus: "verified", emailVerifiedAt: now } });
      await db.session.create({ data: { userId: adminIds[index], tokenHash: hashSessionToken(adminTokens[index]), expiresAt: new Date(now.getTime() + 60 * 60_000) } });
    }
    await db.user.create({ data: { id: ownerId, email: `review-${ownerId}@example.com`, passwordHash: "unused", role: "user", emailVerificationStatus: "verified", emailVerifiedAt: now } });
    await db.session.create({ data: { userId: ownerId, tokenHash: hashSessionToken(ownerToken), expiresAt: new Date(now.getTime() + 60 * 60_000) } });
    await db.incident.create({ data: { id: incidentId, representativeLatitude: 14.916, representativeLongitude: 120.766, locationName: "Plaridel", severity: "High" } });
    await db.floodReport.create({ data: { id: reportId, incidentId, userId: ownerId, title: `Review fixture ${reportId}`, description: "Test flood", category: "Flooding", severity: "High", locationName: "Plaridel, Bulacan", latitude: 14.916, longitude: 120.766 } });
    running = await startTestServer();
    const base = running.baseUrl;
    const route = `${base}/api/admin/reports/${reportId}/verification`;
    const cookie = (token: string) => `floodwatch_auth_session=${token}`;
    const patch = (token: string | null, body: Record<string, unknown>) => fetch(route, { method: "PATCH", headers: { Origin: base, "Content-Type": "application/json", ...(token ? { Cookie: cookie(token) } : {}) }, body: JSON.stringify(body) });
    const current = await db.floodReport.findUniqueOrThrow({ where: { id: reportId } });
    const baseDecision = { expectedReviewVersion: current.reviewVersion, expectedUpdatedAt: current.updatedAt.toISOString(), reason: "Photo and location evidence reviewed." };
    assert.equal((await patch(null, { ...baseDecision, verificationStatus: "verified" })).status, 401);
    assert.equal((await patch(ownerToken, { ...baseDecision, verificationStatus: "verified" })).status, 403);
    assert.equal((await patch(adminTokens[0], { ...baseDecision, verificationStatus: "rejected", reason: "short" })).status, 400);

    const first = await patch(adminTokens[0], { ...baseDecision, verificationStatus: "verified", publicMessage: "Report reviewed by an administrator." });
    assert.equal(first.status, 200);
    assert.equal((await first.json()).data.reviewVersion, 2);
    assert.equal((await patch(adminTokens[1], { ...baseDecision, verificationStatus: "disputed", reason: "Location needs another check." })).status, 409);
    assert.equal(await db.adminOperationalAction.count({ where: { targetType: "FloodReport", targetId: reportId, actionType: "verification" } }), 1);

    const updated = await db.floodReport.findUniqueOrThrow({ where: { id: reportId } });
    const shared = { expectedReviewVersion: updated.reviewVersion, expectedUpdatedAt: updated.updatedAt.toISOString(), reason: "Location needs another independent check." };
    const race = await Promise.all([
      patch(adminTokens[0], { ...shared, verificationStatus: "disputed" }),
      patch(adminTokens[1], { ...shared, verificationStatus: "rejected" }),
    ]);
    assert.deepEqual(race.map((response) => response.status).sort(), [200, 409]);
    const afterRace = await db.floodReport.findUniqueOrThrow({ where: { id: reportId } });
    if (afterRace.verificationStatus !== "rejected") {
      const final = await patch(adminTokens[1], { verificationStatus: "rejected", expectedReviewVersion: afterRace.reviewVersion, expectedUpdatedAt: afterRace.updatedAt.toISOString(), reason: "Location could not be verified after review.", publicMessage: "This report was not accepted after review." });
      assert.equal(final.status, 200);
    }

    const finalReport = await db.floodReport.findUniqueOrThrow({ where: { id: reportId } });
    assert.equal(finalReport.verificationStatus, "rejected");
    assert.ok(finalReport.reviewedAt);
    assert.ok(finalReport.reviewedByUserId);
    assert.equal((await db.incident.findUniqueOrThrow({ where: { id: incidentId } })).reportCount, 0);
    assert.equal((await fetch(`${base}/api/reports/${reportId}`)).status, 404);
    const ownerResponse = await fetch(`${base}/api/reports/${reportId}`, { headers: { Cookie: cookie(ownerToken) } });
    assert.equal(ownerResponse.status, 200);
    const ownerData = (await ownerResponse.json()).data;
    assert.equal(ownerData.verificationStatus, "rejected");
    assert.equal("reviewedByUserId" in ownerData, false);
    const publicList = await fetch(`${base}/api/reports?search=${reportId}`);
    assert.equal((await publicList.json()).pagination.total, 0);
    const map = await fetch(`${base}/api/map/all`);
    assert.equal((await map.json()).reports.some((entry: { id: string }) => entry.id === reportId), false);
    assert.equal(await db.adminOperationalAction.count({ where: { targetType: "FloodReport", targetId: reportId, actionType: "verification" } }), finalReport.reviewVersion - 1);
    assert.equal(await db.adminAuditLog.count({ where: { targetType: "FloodReport", targetId: reportId, action: "ADMIN_REPORT_VERIFICATION_CHANGED" } }), finalReport.reviewVersion - 1);
  } finally {
    if (running) await stopServer(running.server);
    await db.adminOperationalAction.deleteMany({ where: { targetType: "FloodReport", targetId: reportId } });
    await db.adminAuditLog.deleteMany({ where: { targetType: "FloodReport", targetId: reportId } });
    await db.floodReport.deleteMany({ where: { id: reportId } });
    await db.incident.deleteMany({ where: { id: incidentId } });
    await db.session.deleteMany({ where: { userId: { in: [...adminIds, ownerId] } } });
    await db.user.deleteMany({ where: { id: { in: [...adminIds, ownerId] } } });
    await db.$disconnect();
  }
});
