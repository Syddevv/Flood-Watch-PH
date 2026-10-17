import { createHmac, timingSafeEqual } from "node:crypto";

const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

function decodeWebhookSecret(secret: string) {
  const encoded = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  return Buffer.from(encoded, "base64");
}

export function verifyResendWebhook(input: {
  body: string;
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  secret: string | undefined;
  nowSeconds?: number;
}) {
  if (!input.id || !input.timestamp || !input.signature || !input.secret) return false;
  const timestamp = Number(input.timestamp);
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (!Number.isInteger(timestamp) || Math.abs(now - timestamp) > WEBHOOK_TOLERANCE_SECONDS) {
    return false;
  }

  let key: Buffer;
  try {
    key = decodeWebhookSecret(input.secret);
  } catch {
    return false;
  }
  if (key.length === 0) return false;

  const expected = createHmac("sha256", key)
    .update(`${input.id}.${input.timestamp}.${input.body}`)
    .digest();

  return input.signature.split(" ").some((candidate) => {
    const [version, encoded] = candidate.split(",", 2);
    if (version !== "v1" || !encoded) return false;
    const actual = Buffer.from(encoded, "base64");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
}

export function getResendDeliveryUpdate(eventType: string) {
  if (eventType === "email.delivered") return "delivered" as const;
  if (eventType === "email.bounced" || eventType === "email.complained") {
    return "bounced" as const;
  }
  return null;
}
