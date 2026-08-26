/**
 * Required deployment configuration.
 *
 * Both secret getters in the app fall back to a hard-coded development value
 * when NODE_ENV is not "production", which makes a missing secret completely
 * invisible locally and fatal once deployed: every rate-limited route starts
 * failing at the protection layer, before any of its own logic runs.
 *
 * This module is the single description of what a real deployment needs, so a
 * build can refuse to ship without it. Plain TypeScript with no imports, so it
 * runs from a build script and from unit tests alike.
 */

/** Long enough that an HMAC key is not brute-forceable. Matches the getters. */
export const MIN_SECRET_LENGTH = 32;

export type RequiredEnvProblem = "missing" | "too-short";

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
    severity: "warning",
    hint: "Deployed origin. Only consulted when a request's Origin does not match its Host.",
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

  return issues;
}

export function formatRequiredEnvIssues(issues: RequiredEnvIssue[]): string {
  return issues
    .map((issue) => {
      const problem =
        issue.problem === "missing"
          ? "is not set"
          : `is shorter than ${MIN_SECRET_LENGTH} characters`;

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
