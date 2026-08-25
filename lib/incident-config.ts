const DEFAULT_INCIDENT_MATCH_RADIUS_METERS = 300;
const MAX_INCIDENT_MATCH_RADIUS_METERS = 500;
const DEFAULT_INCIDENT_MATCH_TIME_WINDOW_MS = 12 * 60 * 60 * 1000;

export function parseClampedPositiveNumber(
  value: string | undefined,
  fallback: number,
  max: number,
) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, max);
}

export const INCIDENT_MATCH_RADIUS_METERS = parseClampedPositiveNumber(
  process.env.INCIDENT_MATCH_RADIUS_METERS,
  DEFAULT_INCIDENT_MATCH_RADIUS_METERS,
  MAX_INCIDENT_MATCH_RADIUS_METERS,
);

export const INCIDENT_MATCH_TIME_WINDOW_MS = parseClampedPositiveNumber(
  process.env.INCIDENT_MATCH_TIME_WINDOW_MS,
  DEFAULT_INCIDENT_MATCH_TIME_WINDOW_MS,
  Number.POSITIVE_INFINITY,
);
