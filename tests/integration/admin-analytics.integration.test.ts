import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { hashSessionToken } from "@/lib/auth-session-token";
import { integrationTest, startTestServer, stopServer, testDatabaseUrl } from "./test-server";

integrationTest("analytics totals, locality limits, auth and CSV share real data", async () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl! }) });
  const adminId = randomUUID(), token = randomUUID(), incidentId = randomUUID(), reportId = randomUUID();
  const now = new Date();
  const day = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const start = new Date(Date.parse(`${day}T00:00:00Z`) - 8 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  let server: Awaited<ReturnType<typeof startTestServer>> | undefined;
  try {
    await db.user.create({ data: { id: adminId, email: `analytics-${adminId}@example.com`, passwordHash: "unused", role: "admin", emailVerificationStatus: "verified", emailVerifiedAt: now } });
    await db.session.create({ data: { userId: adminId, tokenHash: hashSessionToken(token), expiresAt: new Date(now.getTime() + 60 * 60_000) } });
    await db.incident.create({ data: { id: incidentId, representativeLatitude: 14.916, representativeLongitude: 120.766, locationName: "Integration location", severity: "High" } });
    await db.floodReport.create({ data: { id: reportId, incidentId, title: "Analytics fixture", description: "Fixture", category: "Flooding", severity: "High", locationName: "Integration location", latitude: 14.916, longitude: 120.766, verificationStatus: "verified" } });
    server = await startTestServer();
    const params = `from=${day}&to=${day}&grain=day`;
    const url = `${server.baseUrl}/api/admin/analytics?${params}`;
    assert.equal((await fetch(url)).status, 401);
    const headers = { Cookie: `floodwatch_auth_session=${token}` };
    assert.equal((await fetch(`${server.baseUrl}/api/admin/analytics?from=2026-02-30&to=${day}`, { headers })).status, 400);
    const response = await fetch(url, { headers });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const data = (await response.json()).data;
    assert.equal(data.sources.reports, "complete");
    assert.equal(data.totals.reportIntake, await db.floodReport.count({ where: { createdAt: { gte: start, lt: end } } }));
    assert.equal(data.totals.incidents, await db.incident.count({ where: { createdAt: { gte: start, lt: end } } }));
    assert.equal(data.buckets[0].reports, data.totals.reportIntake);
    assert.equal(data.buckets[0].incidents, data.totals.incidents);
    const exportResponse = await fetch(`${server.baseUrl}/api/admin/analytics/export?${params}`, { headers });
    assert.equal(exportResponse.status, 200);
    const csv = await exportResponse.text();
    assert.ok(csv.includes(`"report intake","${data.totals.reportIntake}","complete"`));
    assert.ok(csv.includes(`"distinct incidents","${data.totals.incidents}","complete"`));
    assert.doesNotMatch(csv, /Integration location/);
    assert.doesNotMatch(csv, /rescue requests|response duration/i);
    assert.equal((await fetch(`${server.baseUrl}/api/admin/analytics/export?${params}`)).status, 401);
    const local = await fetch(`${url}&localityId=0301407000`, { headers });
    assert.equal(local.status, 200);
    const localData = (await local.json()).data;
    assert.equal(localData.sources.reports, "locality_unavailable");
    assert.equal(localData.totals.reportIntake, null);
    assert.equal(localData.totals.reportIntake, null);
  } finally {
    if (server) await stopServer(server.server);
    await db.floodReport.deleteMany({ where: { id: reportId } });
    await db.incident.deleteMany({ where: { id: incidentId } });
    await db.session.deleteMany({ where: { userId: adminId } });
    await db.user.deleteMany({ where: { id: adminId } });
    await db.$disconnect();
  }
});
