import {
  CONFIRMATION_TYPES,
  EVACUATION_CENTER_STATUSES,
  REPORT_CATEGORIES,
  REPORT_SEVERITIES,
  REPORT_SOURCE_TYPES,
  REPORT_STATUSES,
  SAFETY_TIP_CATEGORIES,
} from "./constants";

const isMember = <T extends readonly string[]>(values: T, value: string) =>
  values.includes(value as T[number]);

export function isValidReportSeverity(value: string): boolean {
  return isMember(REPORT_SEVERITIES, value);
}

export function isValidReportStatus(value: string): boolean {
  return (
    isMember(REPORT_STATUSES, value) ||
    value === "active" ||
    value === "receded" ||
    value === "resolved" ||
    value === "Archived" ||
    value === "Active" ||
    value === "Monitoring" ||
    value === "Likely Resolved"
  );
}

export function isValidReportCategory(value: string): boolean {
  return isMember(REPORT_CATEGORIES, value);
}

export function isValidReportSourceType(value: string): boolean {
  return isMember(REPORT_SOURCE_TYPES, value);
}

export function isValidConfirmationType(value: string): boolean {
  return isMember(CONFIRMATION_TYPES, value);
}

export function isValidEvacuationCenterStatus(value: string): boolean {
  return isMember(EVACUATION_CENTER_STATUSES, value);
}

export function isValidSafetyTipCategory(value: string): boolean {
  return isMember(SAFETY_TIP_CATEGORIES, value);
}

export function isValidLatitude(value: number): boolean {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

export function isValidLongitude(value: number): boolean {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

/**
 * Six decimal places is about 0.11 m - finer than any consumer GPS and far
 * below the incident-matching radius, so rounding here changes no behaviour.
 * It exists so the three capture paths agree: the map picker already emits
 * `toFixed(6)` while a GPS fix arrives as a full double.
 *
 * Distinct from `roundWeatherCoordinate` in lib/api-utils.ts, which rounds
 * much coarser on purpose to make weather cache keys collide.
 */
export const REPORT_COORDINATE_PRECISION = 6;

export function roundCoordinate(
  value: number,
  decimals: number = REPORT_COORDINATE_PRECISION,
): number {
  if (!Number.isFinite(value)) {
    return value;
  }

  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;

export function isValidEmail(value: string): boolean {
  return value.length <= MAX_EMAIL_LENGTH && EMAIL_PATTERN.test(value);
}
