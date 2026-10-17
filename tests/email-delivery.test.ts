import assert from "node:assert/strict";
import test from "node:test";

import {
  EmailDeliveryError,
  getEmailDeliveryConfig,
  isAmbiguousEmailDeliveryError,
  sendVerificationEmail,
} from "@/lib/email-delivery";

const configuredEnv = {
  EMAIL_PROVIDER: "emailjs",
  EMAILJS_SERVICE_ID: "service_test",
  EMAILJS_TEMPLATE_ID: "template_test",
  EMAILJS_PUBLIC_KEY: "public_test",
  EMAILJS_PRIVATE_KEY: "private_test",
};

test("EmailJS delivery maps the configured template variables server-side", async () => {
  let requestUrl = "";
  let requestBody = "";
  const fetchImpl: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    requestUrl = request.url;
    requestBody = await request.text();
    return new Response("OK");
  };

  const result = await sendVerificationEmail(
    {
      to: "resident@example.com",
      toName: "Juan",
      code: "123456",
      idempotencyKey: "verification-1",
    },
    { env: configuredEnv, fetchImpl },
  );

  assert.equal(result.messageId, null);
  assert.equal(requestUrl, "https://api.emailjs.com/api/v1.0/email/send");
  assert.deepEqual(JSON.parse(requestBody), {
    service_id: "service_test",
    template_id: "template_test",
    user_id: "public_test",
    accessToken: "private_test",
    template_params: {
      to_email: "resident@example.com",
      to_name: "Juan",
      verification_code: "123456",
      expires_in: "10 minutes",
    },
  });
});

test("EmailJS uses a safe recipient-name fallback", async () => {
  let body: { template_params?: { to_name?: string } } = {};
  const fetchImpl: typeof fetch = async (input, init) => {
    body = (await new Request(input, init).json()) as typeof body;
    return new Response("OK");
  };

  await sendVerificationEmail(
    { to: "resident@example.com", toName: " ", code: "123456", idempotencyKey: "v-2" },
    { env: configuredEnv, fetchImpl },
  );

  assert.equal(body.template_params?.to_name, "Flood Watch resident");
});

test("EmailJS configuration requires the provider and every server-side credential", () => {
  for (const name of [
    "EMAIL_PROVIDER",
    "EMAILJS_SERVICE_ID",
    "EMAILJS_TEMPLATE_ID",
    "EMAILJS_PUBLIC_KEY",
    "EMAILJS_PRIVATE_KEY",
  ]) {
    assert.throws(
      () => getEmailDeliveryConfig({ ...configuredEnv, [name]: undefined }),
      new RegExp(name),
    );
  }

  assert.throws(
    () => getEmailDeliveryConfig({ ...configuredEnv, EMAIL_PROVIDER: "resend" }),
    /EMAIL_PROVIDER/,
  );
});
for (const { status, scenario } of [
  { status: 400, scenario: "invalid service or template" },
  { status: 401, scenario: "invalid public credentials" },
  { status: 403, scenario: "invalid private credentials" },
  { status: 429, scenario: "rate limit or quota exhaustion" },
]) {
  test(`EmailJS ${scenario} failures expose only a bounded safe error`, async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response("sensitive provider details", { status });
    await assert.rejects(
      sendVerificationEmail(
        { to: "resident@example.com", code: "123456", idempotencyKey: `http-${status}` },
        { env: configuredEnv, fetchImpl },
      ),
      (error: unknown) =>
        error instanceof EmailDeliveryError &&
        error.safeCode === `provider_http_${status}` &&
        !error.message.includes("sensitive provider details"),
    );
  });
}

test("network failures are recorded as ambiguous without leaking details", async () => {
  const fetchImpl: typeof fetch = async () => {
    throw new Error("private network detail");
  };
  await assert.rejects(
    sendVerificationEmail(
      { to: "resident@example.com", code: "123456", idempotencyKey: "network" },
      { env: configuredEnv, fetchImpl },
    ),
    (error: unknown) =>
      error instanceof EmailDeliveryError &&
      error.safeCode === "provider_network_error" &&
      isAmbiguousEmailDeliveryError(error) &&
      !error.message.includes("private network detail"),
  );
});

test("EmailJS requests time out without an automatic retry", async () => {
  let requests = 0;
  const fetchImpl: typeof fetch = async (_input, init) => {
    requests += 1;
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(new DOMException("aborted", "AbortError"));
      });
    });
  };

  await assert.rejects(
    sendVerificationEmail(
      { to: "resident@example.com", code: "123456", idempotencyKey: "timeout" },
      { env: configuredEnv, fetchImpl, timeoutMs: 5 },
    ),
    (error: unknown) =>
      error instanceof EmailDeliveryError &&
      error.safeCode === "provider_timeout" &&
      isAmbiguousEmailDeliveryError(error),
  );
  assert.equal(requests, 1);
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
