import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { getResendDeliveryUpdate, verifyResendWebhook } from "@/lib/resend-webhook";

test("Resend webhook signatures require a fresh matching Svix signature", () => {
  const body = JSON.stringify({ type: "email.delivered" });
  const id = "msg_test";
  const timestamp = "1792195200";
  const key = Buffer.from("webhook-test-secret");
  const secret = `whsec_${key.toString("base64")}`;
  const signature = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");

  assert.equal(
    verifyResendWebhook({
      body,
      id,
      timestamp,
      signature: `v1,${signature}`,
      secret,
      nowSeconds: Number(timestamp),
    }),
    true,
  );
  assert.equal(
    verifyResendWebhook({
      body: `${body} `,
      id,
      timestamp,
      signature: `v1,${signature}`,
      secret,
      nowSeconds: Number(timestamp),
    }),
    false,
  );
  assert.equal(
    verifyResendWebhook({
      body,
      id,
      timestamp,
      signature: `v1,${signature}`,
      secret,
      nowSeconds: Number(timestamp) + 301,
    }),
    false,
  );
});

test("only delivery, bounce, and complaint events change delivery state", () => {
  assert.equal(getResendDeliveryUpdate("email.delivered"), "delivered");
  assert.equal(getResendDeliveryUpdate("email.bounced"), "bounced");
  assert.equal(getResendDeliveryUpdate("email.complained"), "bounced");
  assert.equal(getResendDeliveryUpdate("email.opened"), null);
});
