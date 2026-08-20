import "server-only";

import { createHmac } from "node:crypto";

import { errorResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { getRateLimitIdentity } from "@/lib/rate-limit-identity";
import { getReportSessionHashFromRequest } from "@/lib/report-session";

type RateLimitRow = {
  count: number;
  expiresAt: Date;
};

type ApiProtectionOptions = {
  scope: string;
  limit: number;
  windowMs: number;
  requireTrustedOrigin?: boolean;
};

function getProtectionSecret() {
  const secret =
    process.env.ABUSE_PROTECTION_SECRET ?? process.env.REPORT_SESSION_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV !== "production") {
      return "floodwatch-local-development-abuse-protection-secret";
    }

    throw new Error(
      "ABUSE_PROTECTION_SECRET or REPORT_SESSION_SECRET must be set in production.",
    );
  }

  if (secret.length < 32) {
    throw new Error("The abuse protection secret must be at least 32 characters.");
  }

  return secret;
}

function createRateLimitKey(request: Request, scope: string) {
  const identity = getRateLimitIdentity(
    request,
    getReportSessionHashFromRequest(request),
    process.env.TRUSTED_PROXY_CLIENT_IP_HEADER,
  );
  const addressHash = createHmac("sha256", getProtectionSecret())
    .update(identity)
    .digest("hex");

  return `${scope}:${addressHash}`;
}

function isTrustedOrigin(request: Request) {
  const origin = request.headers.get("origin");

  if (!origin) {
    return process.env.NODE_ENV !== "production";
  }

  const requestOrigin = new URL(request.url).origin;

  if (origin === requestOrigin) {
    return true;
  }

  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL;

  if (!configuredOrigin) {
    return false;
  }

  try {
    return origin === new URL(configuredOrigin).origin;
  } catch {
    return false;
  }
}

async function consumeRateLimit(
  request: Request,
  { scope, limit, windowMs }: ApiProtectionOptions,
) {
  const key = createRateLimitKey(request, scope);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + windowMs);
  const rows = await prisma.$queryRaw<RateLimitRow[]>`
    INSERT INTO "RequestRateLimit" ("key", "count", "windowStart", "expiresAt")
    VALUES (${key}, 1, ${now}, ${expiresAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RequestRateLimit"."expiresAt" <= ${now} THEN 1
        ELSE "RequestRateLimit"."count" + 1
      END,
      "windowStart" = CASE
        WHEN "RequestRateLimit"."expiresAt" <= ${now} THEN ${now}
        ELSE "RequestRateLimit"."windowStart"
      END,
      "expiresAt" = CASE
        WHEN "RequestRateLimit"."expiresAt" <= ${now} THEN ${expiresAt}
        ELSE "RequestRateLimit"."expiresAt"
      END
    RETURNING "count", "expiresAt"
  `;
  const result = rows[0];

  if (!result) {
    throw new Error("The rate limiter did not return a result.");
  }

  return {
    allowed: result.count <= limit,
    expiresAt: result.expiresAt,
  };
}

export async function protectApiRequest(
  request: Request,
  options: ApiProtectionOptions,
) {
  if (options.requireTrustedOrigin && !isTrustedOrigin(request)) {
    return errorResponse("This request origin is not allowed.", 403);
  }

  try {
    const result = await consumeRateLimit(request, options);

    if (result.allowed) {
      return null;
    }

    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((result.expiresAt.getTime() - Date.now()) / 1000),
    );

    return errorResponse("Too many requests. Please try again later.", 429, {
      headers: {
        "Retry-After": String(retryAfterSeconds),
        "X-RateLimit-Limit": String(options.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(result.expiresAt.getTime() / 1000)),
      },
    });
  } catch (error) {
    console.error("Failed to apply API abuse protection.", error);
    return errorResponse("Request protection is temporarily unavailable.", 503);
  }
}
