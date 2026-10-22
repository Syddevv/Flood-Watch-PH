import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { hashSessionToken } from "@/lib/auth-session-token";
import { integrationTest, startTestServer, stopServer, testDatabaseUrl } from "./test-server";

integrationTest("retired routes cannot accept writes and historical notices stay stored but hidden", async () => {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl! }) });
  const adminId = randomUUID(), token = randomUUID();
  let server: Awaited<ReturnType<typeof startTestServer>> | undefined;
  try {
    await db.user.create({ data: { id: adminId, email: `retirement-${adminId}@example.com`, passwordHash: "unused", role: "admin", emailVerificationStatus: "verified", emailVerifiedAt: new Date() } });
    await db.session.create({ data: { userId: adminId, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + 60 * 60_000) } });
    const historical = await db.adminNotification.create({ data: { recipientUserId: adminId, type: "rescue_received", title: "Retired private notice", detail: "Historical request", targetType: "RescueRequest", targetId: randomUUID() } });
    const active = await db.adminNotification.create({ data: { recipientUserId: adminId, type: "system", title: "Current notice", detail: "Current system message" } });
    server = await startTestServer();
    const headers = { Cookie: `floodwatch_auth_session=${token}` };
    for (const path of ["/rescue-request", "/admin/rescue-requests", "/admin/responders", "/api/rescue-requests", "/api/admin/rescue-requests", "/api/admin/responders"]) {
      assert.equal((await fetch(`${server.baseUrl}${path}`, { headers })).status, 404, path);
    }
    for (const path of ["/api/rescue-requests", "/api/admin/rescue-requests", "/api/admin/responders"]) {
      assert.equal((await fetch(`${server.baseUrl}${path}`, { method: "POST", headers: { ...headers, Origin: server.baseUrl, "Content-Type": "application/json" }, body: "{}" })).status, 404, path);
    }
    const response = await fetch(`${server.baseUrl}/api/admin/notifications`, { headers });
    assert.equal(response.status, 200);
    const payload = (await response.json()).data;
    assert.equal(payload.unreadCount, 1);
    assert.deepEqual(payload.notifications.map((notice: { id: string }) => notice.id), [active.id]);
    const marked = await fetch(`${server.baseUrl}/api/admin/notifications`, { method: "PATCH", headers: { ...headers, Origin: server.baseUrl, "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) });
    assert.equal(marked.status, 200);
    assert.equal((await db.adminNotification.findUniqueOrThrow({ where: { id: historical.id } })).readAt, null);
    assert.ok((await db.adminNotification.findUniqueOrThrow({ where: { id: active.id } })).readAt);
  } finally {
    if (server) await stopServer(server.server);
    await db.adminNotification.deleteMany({ where: { recipientUserId: adminId } });
    await db.session.deleteMany({ where: { userId: adminId } });
    await db.user.deleteMany({ where: { id: adminId } });
    await db.$disconnect();
  }
});
