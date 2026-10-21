/**
 * Required deployment configuration.
 *
 * Both secret getters in the app fall back to a hard-coded development value
 * when NODE_ENV is not "production", which makes a missing secret completely
 * invisible locally and fatal once deployed: every rate-limited route starts
 * failing at the protection layer, before any of its own logic runs.
 *
 * This module is the single description of what a real deployment needs, so a
 * build can refuse to ship without it. It has no runtime service dependencies,
 * so it runs from a build script and from unit tests alike.
 */
import { ROLLOUT_FLAGS } from "@/lib/rollout-gates";

/** Long enough that an HMAC key is not brute-forceable. Matches the getters. */
export const MIN_SECRET_LENGTH = 32;

export type RequiredEnvProblem = "missing" | "too-short" | "invalid";

export type RequiredEnvIssue = {
  name: string;
  problem: RequiredEnvProblem;
  severity: "error" | "warning";
  hint: string;
};

type EnvLike = Record<string, string | undefined>;

type EnvRequirement = {
  name: string;
  minLength?: number;
  severity: "error" | "warning";
  hint: string;
  /** Satisfied instead by any of these, if set. */
  satisfiedBy?: string[];
};

const REQUIREMENTS: EnvRequirement[] = [
  {
    name: "DATABASE_URL",
    severity: "error",
    hint: "Postgres connection string. Without it every database-backed route fails.",
  },
  {
    name: "REPORT_SESSION_SECRET",
    minLength: MIN_SECRET_LENGTH,
    severity: "error",
    hint: `Random value of at least ${MIN_SECRET_LENGTH} characters. Signs anonymous report-session cookies and, unless ABUSE_PROTECTION_SECRET is set, keys the API rate limiter - so a missing value takes down reports, weather, and sign-in at once.`,
  },
  {
    name: "ABUSE_PROTECTION_SECRET",
    minLength: MIN_SECRET_LENGTH,
    severity: "warning",
    satisfiedBy: ["REPORT_SESSION_SECRET"],
    hint: "Optional. Falls back to REPORT_SESSION_SECRET when unset.",
  },
  {
    name: "NEXT_PUBLIC_APP_URL",
    severity: "error",
    hint: "Exact deployed origin. Used as the trusted fallback when a request's Origin does not match its Host.",
  },
  {
    name: "EMAIL_PROVIDER",
    severity: "error",
    hint: 'Transactional email provider. Phase U3 requires the value "emailjs".',
  },
  {
    name: "EMAILJS_SERVICE_ID",
    severity: "error",
    hint: "EmailJS service connected to the verification-email sender.",
  },
  {
    name: "EMAILJS_TEMPLATE_ID",
    severity: "error",
    hint: "EmailJS template containing the U3 verification message.",
  },
  {
    name: "EMAILJS_PUBLIC_KEY",
    severity: "error",
    hint: "EmailJS account public key. Kept server-side with the private key.",
  },
  {
    name: "EMAILJS_PRIVATE_KEY",
    severity: "error",
    hint: "Server-only EmailJS private key used to authorize delivery.",
  },
  {
    name: "EMAIL_VERIFICATION_HMAC_KEY",
    minLength: MIN_SECRET_LENGTH,
    severity: "error",
    hint: "Random server-only key used to HMAC verification codes before storage.",
  },
  {
    name: "LEGACY_EMAIL_GRACE_DEADLINE",
    severity: "error",
    hint: "ISO-8601 cutoff after which unreviewed legacy accounts and sessions are rejected.",
  },
  {
    name: "CLOUDINARY_CLOUD_NAME",
    severity: "warning",
    hint: "Required for report photo uploads; other features work without it.",
  },
  {
    name: "CLOUDINARY_API_KEY",
    severity: "warning",
    hint: "Required for report photo uploads; other features work without it.",
  },
  {
    name: "CLOUDINARY_API_SECRET",
    severity: "warning",
    hint: "Required for report photo uploads; other features work without it.",
  },
];

export function findRequiredEnvIssues(env: EnvLike): RequiredEnvIssue[] {
  const issues: RequiredEnvIssue[] = [];

  for (const requirement of REQUIREMENTS) {
    const value = env[requirement.name]?.trim();

    if (!value) {
      const substitute = requirement.satisfiedBy?.some((name) => env[name]?.trim());

      if (substitute) {
        continue;
      }

      issues.push({
        name: requirement.name,
        problem: "missing",
        severity: requirement.severity,
        hint: requirement.hint,
      });
      continue;
    }

    if (requirement.minLength && value.length < requirement.minLength) {
      issues.push({
        name: requirement.name,
        problem: "too-short",
        severity: requirement.severity,
        hint: requirement.hint,
      });
    }
  }

  if (
    env.EMAIL_PROVIDER?.trim() &&
    env.EMAIL_PROVIDER.trim().toLowerCase() !== "emailjs"
  ) {
    issues.push({
      name: "EMAIL_PROVIDER",
      problem: "invalid",
      severity: "error",
      hint: 'Phase U3 currently supports only the value "emailjs".',
    });
  }

  for (const name of [
    "EMAILJS_SERVICE_ID",
    "EMAILJS_TEMPLATE_ID",
    "EMAILJS_PUBLIC_KEY",
    "EMAILJS_PRIVATE_KEY",
  ]) {
    const value = env[name]?.trim();
    if (value && (value.length > 256 || /[\u0000-\u001f\u007f]/.test(value))) {
      issues.push({
        name,
        problem: "invalid",
        severity: "error",
        hint: "Use the unmodified value from EmailJS without control characters.",
      });
    }
  }

  const appUrl = env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) {
    try {
      const parsed = new URL(appUrl);
      if (!/^https?:$/.test(parsed.protocol) || parsed.origin !== appUrl.replace(/\/$/, "")) {
        throw new Error("invalid origin");
      }
    } catch {
      issues.push({
        name: "NEXT_PUBLIC_APP_URL",
        problem: "invalid",
        severity: "error",
        hint: "Use the exact deployed http(s) origin with no path, query, or fragment.",
      });
    }
  }

  const graceDeadline = env.LEGACY_EMAIL_GRACE_DEADLINE?.trim();
  if (graceDeadline && !Number.isFinite(Date.parse(graceDeadline))) {
    issues.push({
      name: "LEGACY_EMAIL_GRACE_DEADLINE",
      problem: "invalid",
      severity: "error",
      hint: "Use a complete ISO-8601 timestamp such as 2027-01-31T00:00:00.000Z.",
    });
  }

  for (const name of Object.values(ROLLOUT_FLAGS)) {
    const value = env[name];
    if (value !== undefined && value !== "on" && value !== "off") {
      issues.push({ name, problem: "invalid", severity: "error", hint: 'Use exactly "on" or "off". An unset flag preserves current behavior.' });
    }
  }

  return issues;
}

export function formatRequiredEnvIssues(issues: RequiredEnvIssue[]): string {
  return issues
    .map((issue) => {
      const problem =
        issue.problem === "missing"
          ? "is not set"
          : issue.problem === "too-short"
            ? `is shorter than ${MIN_SECRET_LENGTH} characters`
            : "has an invalid value";

      return `  - ${issue.name} ${problem}\n      ${issue.hint}`;
    })
    .join("\n");
}

/**
 * Hard-fail only where the configuration is known to be managed: a Vercel
 * build, or CI (whose workflow sets these explicitly). A developer building
 * locally gets a warning instead of a broken workflow.
 */
export function shouldFailOnEnvIssues(env: EnvLike): boolean {
  return Boolean(env.VERCEL || env.CI);
}
