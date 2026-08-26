/**
 * Build-time configuration check.
 *
 * Runs from `prebuild`. On Vercel and in CI a missing required variable fails
 * the build; locally it only warns, so day-to-day `npm run build` is
 * unaffected. This exists because the failure it catches is otherwise silent:
 * secrets fall back to a development value when NODE_ENV is not "production",
 * so a deployment missing REPORT_SESSION_SECRET builds and starts perfectly
 * and then fails every rate-limited request at runtime.
 */

import {
  findRequiredEnvIssues,
  formatRequiredEnvIssues,
  shouldFailOnEnvIssues,
} from "../lib/required-env";

const issues = findRequiredEnvIssues(process.env);
const errors = issues.filter((issue) => issue.severity === "error");
const warnings = issues.filter((issue) => issue.severity === "warning");

if (warnings.length > 0) {
  console.warn(
    `\nFloodWatch PH: optional configuration not set\n${formatRequiredEnvIssues(warnings)}\n`,
  );
}

if (errors.length === 0) {
  process.exit(0);
}

const report = `\nFloodWatch PH: required configuration missing\n${formatRequiredEnvIssues(errors)}\n`;

if (shouldFailOnEnvIssues(process.env)) {
  console.error(
    `${report}\nSet these in the deployment environment (Vercel: Settings -> Environment` +
      ` Variables) and redeploy. Refusing to build a deployment that would fail at runtime.\n`,
  );
  process.exit(1);
}

console.warn(
  `${report}\nThis is only a warning locally, where secrets fall back to development` +
    ` values. A real deployment without them will fail every rate-limited request.\n`,
);
