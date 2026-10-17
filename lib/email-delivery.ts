import { ConfigurationError } from "@/lib/configuration-error";

type EnvLike = Record<string, string | undefined>;
type FetchLike = typeof fetch;

const EMAILJS_SEND_URL = "https://api.emailjs.com/api/v1.0/email/send";
const EMAILJS_REQUEST_TIMEOUT_MS = 10_000;
const EMAILJS_CONFIG_MAX_LENGTH = 256;
const FALLBACK_RECIPIENT_NAME = "Flood Watch resident";

export class EmailDeliveryError extends Error {
  readonly safeCode: string;
  readonly outcome: "rejected" | "ambiguous";

  constructor(
    safeCode: string,
    outcome: "rejected" | "ambiguous" = "rejected",
  ) {
    super("The verification email provider did not accept the message.");
    this.name = "EmailDeliveryError";
    this.safeCode = safeCode;
    this.outcome = outcome;
  }
}

export function isAmbiguousEmailDeliveryError(
  error: unknown,
): error is EmailDeliveryError & { outcome: "ambiguous" } {
  return error instanceof EmailDeliveryError && error.outcome === "ambiguous";
}

function isTestDeliveryStubEnabled(env: EnvLike) {
  const testDatabaseUrl = env.TEST_DATABASE_URL;
  return Boolean(
    env.EMAIL_DELIVERY_TEST_STUB &&
      testDatabaseUrl &&
      env.DATABASE_URL === testDatabaseUrl,
  );
}

function readEmailJsConfigValue(name: string, env: EnvLike) {
  const value = env[name]?.trim();
  if (!value) {
    throw new ConfigurationError(`${name} must be configured.`);
  }
  if (value.length > EMAILJS_CONFIG_MAX_LENGTH || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new ConfigurationError(`${name} has an invalid value.`);
  }
  return value;
}

export function getEmailDeliveryConfig(env: EnvLike = process.env) {
  if (env.EMAIL_PROVIDER?.trim().toLowerCase() !== "emailjs") {
    throw new ConfigurationError('EMAIL_PROVIDER must be set to "emailjs".');
  }

  return {
    serviceId: readEmailJsConfigValue("EMAILJS_SERVICE_ID", env),
    templateId: readEmailJsConfigValue("EMAILJS_TEMPLATE_ID", env),
    publicKey: readEmailJsConfigValue("EMAILJS_PUBLIC_KEY", env),
    privateKey: readEmailJsConfigValue("EMAILJS_PRIVATE_KEY", env),
  };
}

function getRecipientName(value: string | null | undefined) {
  const name = value?.replace(/[\u0000-\u001f\u007f<>]/g, " ").trim();
  return name || FALLBACK_RECIPIENT_NAME;
}

export async function sendVerificationEmail(
  input: {
    to: string;
    toName?: string | null;
    code: string;
    idempotencyKey: string;
  },
  options: {
    env?: EnvLike;
    fetchImpl?: FetchLike;
    timeoutMs?: number;
  } = {},
) {
  const env = options.env ?? process.env;

  if (isTestDeliveryStubEnabled(env)) {
    if (env.EMAIL_DELIVERY_TEST_STUB === "failure") {
      throw new EmailDeliveryError("test_provider_failure");
    }
    return { messageId: `test-${input.idempotencyKey}` };
  }

  const config = getEmailDeliveryConfig(env);
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? EMAILJS_REQUEST_TIMEOUT_MS,
  );

  let response: Response;
  try {
    response = await (options.fetchImpl ?? fetch)(EMAILJS_SEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        service_id: config.serviceId,
        template_id: config.templateId,
        user_id: config.publicKey,
        accessToken: config.privateKey,
        template_params: {
          to_email: input.to,
          to_name: getRecipientName(input.toName),
          verification_code: input.code,
          expires_in: "10 minutes",
        },
      }),
    });
  } catch (error) {
    if (
      controller.signal.aborted ||
      (error instanceof Error && error.name === "AbortError")
    ) {
      throw new EmailDeliveryError("provider_timeout", "ambiguous");
    }
    throw new EmailDeliveryError("provider_network_error", "ambiguous");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new EmailDeliveryError(`provider_http_${response.status}`);
  }

  // EmailJS returns no durable provider message ID. A 2xx response means only
  // that its API accepted the request, not that the recipient received it.
  return { messageId: null };
}
