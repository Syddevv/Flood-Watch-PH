import { ConfigurationError } from "@/lib/configuration-error";

type EnvLike = Record<string, string | undefined>;
type FetchLike = typeof fetch;

export class EmailDeliveryError extends Error {
  readonly safeCode: string;

  constructor(safeCode: string) {
    super("The verification email provider did not accept the message.");
    this.name = "EmailDeliveryError";
    this.safeCode = safeCode;
  }
}

function isTestDeliveryStubEnabled(env: EnvLike) {
  const testDatabaseUrl = env.TEST_DATABASE_URL;
  return Boolean(
    env.EMAIL_DELIVERY_TEST_STUB &&
      testDatabaseUrl &&
      env.DATABASE_URL === testDatabaseUrl,
  );
}

export function getEmailDeliveryConfig(env: EnvLike = process.env) {
  if (env.EMAIL_PROVIDER?.trim().toLowerCase() !== "resend") {
    throw new ConfigurationError('EMAIL_PROVIDER must be set to "resend".');
  }

  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.EMAIL_FROM_ADDRESS?.trim();
  if (!apiKey || !from) {
    throw new ConfigurationError(
      "RESEND_API_KEY and EMAIL_FROM_ADDRESS must be configured.",
    );
  }

  return { apiKey, from };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function renderVerificationEmail(code: string) {
  const safeCode = escapeHtml(code);
  return {
    subject: `${code} is your Flood Watch verification code`,
    text: `Verify your Flood Watch email with this code: ${code}\n\nThis code expires in 10 minutes and can be used once. Flood Watch will never ask you to share this code. If you did not create an account, ignore this email.`,
    html: `<!doctype html>
<html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;background:#f4f7f8;font-family:Arial,sans-serif;color:#16302b">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7f8;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;border:1px solid #dce7e3;overflow:hidden">
        <tr><td style="background:#075f52;padding:24px;color:#ffffff;font-size:22px;font-weight:700">Flood Watch</td></tr>
        <tr><td style="padding:32px 28px">
          <h1 style="margin:0 0 12px;font-size:24px">Verify your email</h1>
          <p style="margin:0 0 24px;line-height:1.6;color:#52645f">Enter this six-digit code to finish creating your Flood Watch account.</p>
          <div style="padding:18px;text-align:center;background:#eef7f4;border-radius:12px;font-size:34px;font-weight:700;letter-spacing:10px;color:#075f52">${safeCode}</div>
          <p style="margin:24px 0 8px;line-height:1.6;color:#52645f">This code expires in 10 minutes and can only be used once.</p>
          <p style="margin:0;line-height:1.6;color:#52645f">Never share this code. Flood Watch staff will not ask for it. If you did not create an account, you can safely ignore this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
  };
}

export async function sendVerificationEmail(
  input: { to: string; code: string; idempotencyKey: string },
  options: { env?: EnvLike; fetchImpl?: FetchLike } = {},
) {
  const env = options.env ?? process.env;

  if (isTestDeliveryStubEnabled(env)) {
    if (env.EMAIL_DELIVERY_TEST_STUB === "failure") {
      throw new EmailDeliveryError("test_provider_failure");
    }
    return { messageId: `test-${input.idempotencyKey}` };
  }

  const { apiKey, from } = getEmailDeliveryConfig(env);
  const message = renderVerificationEmail(input.code);
  const response = await (options.fetchImpl ?? fetch)("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
  });

  if (!response.ok) {
    throw new EmailDeliveryError(`provider_http_${response.status}`);
  }

  const payload = (await response.json().catch(() => null)) as { id?: unknown } | null;
  if (!payload || typeof payload.id !== "string" || !payload.id) {
    throw new EmailDeliveryError("provider_invalid_response");
  }

  return { messageId: payload.id };
}
