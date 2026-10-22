import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { hashPassword } from "@/lib/password";

import { createTestLocationVerification, integrationTest, startTestServer, stopServer } from "./test-server";

function uniqueEmail(runId: string, label: string) {
  return `integration-verification-${label}-${runId}@example.com`;
}

async function postJson(
  baseUrl: string,
  path: string,
  address: string,
  body: Record<string, unknown>,
) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      Origin: baseUrl,
      "Content-Type": "application/json",
      "X-Forwarded-For": address,
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as {
    data?: Record<string, unknown>;
    error?: string;
    code?: string;
  };
  return { response, payload };
}

const register = async (baseUrl: string, address: string, email: string) =>
  postJson(baseUrl, "/api/auth/register", address, {
    email,
    password: "correct-horse-battery-staple",
    fullName: "Test Resident",
    locationToken: await createTestLocationVerification(email),
  });

const verify = (baseUrl: string, address: string, email: string, code: string) =>
  postJson(baseUrl, "/api/auth/verify-code", address, { email, code });

integrationTest(
  "verification enforces expiry, attempt limits, resend invalidation, and concurrent single use",
  async () => {
    const { prisma } = await import("@/lib/prisma");
    const runId = randomUUID();
    const { baseUrl, server } = await startTestServer();
    const emails = {
      expired: uniqueEmail(runId, "expired"),
      exhausted: uniqueEmail(runId, "exhausted"),
      resend: uniqueEmail(runId, "resend"),
      concurrent: uniqueEmail(runId, "concurrent"),
      legacy: uniqueEmail(runId, "legacy"),
    };

    try {
      await register(baseUrl, `${runId}-expired`, emails.expired);
      const expiredUser = await prisma.user.findUniqueOrThrow({
        where: { email: emails.expired },
      });
      await prisma.emailVerification.update({
        where: { userId: expiredUser.id },
        data: { expiresAt: new Date(Date.now() - 1) },
      });
      const expired = await verify(baseUrl, `${runId}-expired`, emails.expired, "123456");
      assert.equal(expired.payload.code, "CODE_EXPIRED");

      await register(baseUrl, `${runId}-exhausted`, emails.exhausted);
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const result = await verify(
          baseUrl,
          `${runId}-exhausted`,
          emails.exhausted,
          "000000",
        );
        assert.equal(result.response.status, 400);
      }
      const exhausted = await verify(
        baseUrl,
        `${runId}-exhausted`,
        emails.exhausted,
        "123456",
      );
      assert.equal(exhausted.payload.code, "CODE_EXHAUSTED");

      await register(baseUrl, `${runId}-resend`, emails.resend);
      const resendUser = await prisma.user.findUniqueOrThrow({
        where: { email: emails.resend },
      });
      await prisma.emailVerification.update({
        where: { userId: resendUser.id },
        data: { resendAvailableAt: new Date(Date.now() - 1) },
      });
      const resent = await postJson(
        baseUrl,
        "/api/auth/resend-verification",
        `${runId}-resend`,
        { email: emails.resend },
      );
      assert.equal(resent.response.status, 202);
      assert.equal(
        (await verify(baseUrl, `${runId}-resend`, emails.resend, "123456")).response
          .status,
        400,
      );
      assert.equal(
        (await verify(baseUrl, `${runId}-resend`, emails.resend, "123457")).response
          .status,
        200,
      );

      await register(baseUrl, `${runId}-concurrent`, emails.concurrent);
      const concurrent = await Promise.all([
        verify(baseUrl, `${runId}-concurrent-a`, emails.concurrent, "123456"),
        verify(baseUrl, `${runId}-concurrent-b`, emails.concurrent, "123456"),
      ]);
      assert.deepEqual(
        concurrent.map((result) => result.response.status).sort(),
        [200, 400],
      );

      await prisma.user.create({
        data: {
          email: emails.legacy,
          passwordHash: await hashPassword("correct-horse-battery-staple"),
          emailVerificationStatus: "legacy_grace",
        },
      });
      const legacyLogin = await postJson(
        baseUrl,
        "/api/auth/login",
        `${runId}-legacy`,
        { email: emails.legacy, password: "correct-horse-battery-staple" },
      );
      assert.equal(legacyLogin.response.status, 200);
    } finally {
      await prisma.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
      await stopServer(server);
    }
  },
);

integrationTest("email delivery failure leaves the account pending without a session", async () => {
  const { prisma } = await import("@/lib/prisma");
  const runId = randomUUID();
  const email = uniqueEmail(runId, "delivery-failure");
  const { baseUrl, server } = await startTestServer({
    EMAIL_DELIVERY_TEST_STUB: "failure",
  });

  try {
    const result = await register(baseUrl, `integration-delivery-${runId}`, email);
    assert.equal(result.response.status, 503);
    assert.equal(result.payload.code, "VERIFICATION_DELIVERY_FAILED");
    assert.equal(result.response.headers.get("set-cookie"), null);

    const user = await prisma.user.findUnique({
      where: { email },
      include: { emailVerification: true },
    });
    assert.equal(user?.emailVerificationStatus, "pending");
    assert.equal(user?.emailVerification?.deliveryStatus, "failed");
    assert.ok(
      (user?.emailVerification?.resendAvailableAt.getTime() ?? Infinity) <= Date.now(),
      "failed delivery should allow an immediate resend",
    );
  } finally {
    await prisma.user.deleteMany({ where: { email } });
    await stopServer(server);
  }
});
