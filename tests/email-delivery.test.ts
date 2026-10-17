import assert from "node:assert/strict";
import test from "node:test";

import {
  EmailDeliveryError,
  renderVerificationEmail,
  sendVerificationEmail,
} from "@/lib/email-delivery";

const configuredEnv = {
  EMAIL_PROVIDER: "resend",
  RESEND_API_KEY: "re_test_secret",
  EMAIL_FROM_ADDRESS: "Flood Watch <verify@example.com>",
};

test("Resend delivery keeps credentials server-side and sends both text and HTML", async () => {
  let authorization = "";
  let requestBody = "";
  const fetchImpl: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    authorization = request.headers.get("authorization") ?? "";
    requestBody = await request.text();
    return Response.json({ id: "email-message-1" });
  };

  const result = await sendVerificationEmail(
    { to: "resident@example.com", code: "123456", idempotencyKey: "verification-1" },
    { env: configuredEnv, fetchImpl },
  );

  assert.equal(result.messageId, "email-message-1");
  assert.equal(authorization, "Bearer re_test_secret");
  const body = JSON.parse(requestBody) as { html: string; text: string; to: string[] };
  assert.deepEqual(body.to, ["resident@example.com"]);
  assert.match(body.html, /123456/);
  assert.match(body.text, /expires in 10 minutes/i);
  assert.equal(JSON.stringify(body).includes("re_test_secret"), false);
});

test("provider failures expose only a bounded safe error", async () => {
  const fetchImpl: typeof fetch = async () => new Response("provider details", { status: 429 });
  await assert.rejects(
    sendVerificationEmail(
      { to: "resident@example.com", code: "123456", idempotencyKey: "verification-2" },
      { env: configuredEnv, fetchImpl },
    ),
    (error: unknown) =>
      error instanceof EmailDeliveryError && error.safeCode === "provider_http_429",
  );
});

test("the delivery stub is bound to the active test database", async () => {
  const stubEnv = {
    EMAIL_DELIVERY_TEST_STUB: "success",
    TEST_DATABASE_URL: "postgresql://test",
    DATABASE_URL: "postgresql://test",
  };
  const result = await sendVerificationEmail(
    { to: "resident@example.com", code: "123456", idempotencyKey: "verification-3" },
    { env: stubEnv },
  );
  assert.equal(result.messageId, "test-verification-3");

  await assert.rejects(
    sendVerificationEmail(
      { to: "resident@example.com", code: "123456", idempotencyKey: "verification-4" },
      { env: { ...stubEnv, DATABASE_URL: "postgresql://production" } },
    ),
    /EMAIL_PROVIDER/,
  );
});

test("the Flood Watch template includes expiry and security guidance", () => {
  const message = renderVerificationEmail("123456");
  assert.match(message.subject, /Flood Watch/);
  assert.match(message.html, /expires in 10 minutes/i);
  assert.match(message.html, /Never share this code/i);
});
