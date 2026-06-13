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
  return isMember(REPORT_STATUSES, value);
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
