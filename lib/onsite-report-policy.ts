import {
  distanceToBulacanBoundaryMeters,
  isWithinBulacan,
} from "@/lib/bulacan-scope";
import { calculateDistanceMeters } from "@/lib/report-geo";
import { isValidLatitude, isValidLongitude, roundCoordinate } from "@/lib/validations";

/** Provisional values pending the field trial recorded in docs/onsite-reporting.md. */
export const ONSITE_REPORT_POLICY = {
  version: "u2-provisional-2026-10-17",
  maximumGpsAgeMs: 2 * 60 * 1000,
  maximumGpsAccuracyMeters: 100,
  maximumPhotoAgeMs: 5 * 60 * 1000,
  maximumFutureSkewMs: 30 * 1000,
  baseFixToReportDistanceMeters: 150,
} as const;

export type OnsiteEvidence = {
  gpsLatitude: number;
  gpsLongitude: number;
  gpsAccuracyMeters: number;
  gpsCapturedAt: Date;
  photoCapturedAt: Date;
  policyVersion: string;
};

export type OnsiteEvidenceErrorCode =
  | "image_required"
  | "gps_required"
  | "gps_outside_scope"
  | "gps_stale"
  | "gps_inaccurate"
  | "border_review_required"
  | "photo_time_required"
  | "photo_stale"
  | "location_too_far";

type ValidationResult =
  | { data: OnsiteEvidence; error?: never; code?: never }
  | { data?: never; error: string; code: OnsiteEvidenceErrorCode };

function parseDate(raw: FormDataEntryValue | null) {
  if (typeof raw !== "string" || !raw.trim()) {
    return null;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isFresh(timestamp: Date, maximumAgeMs: number, now: Date) {
  const ageMs = now.getTime() - timestamp.getTime();
  return ageMs >= -ONSITE_REPORT_POLICY.maximumFutureSkewMs && ageMs <= maximumAgeMs;
}

export function validateOnsiteReportEvidence(
  formData: FormData,
  input: {
    reportLatitude: number;
    reportLongitude: number;
    imagePresent: boolean;
    now?: Date;
  },
): ValidationResult {
  const now = input.now ?? new Date();

  if (!input.imagePresent) {
    return {
      code: "image_required",
      error: "A fresh photo captured with the in-app camera is required.",
    };
  }

  const rawGpsLatitude = Number(formData.get("gpsLatitude"));
  const rawGpsLongitude = Number(formData.get("gpsLongitude"));
  const rawGpsAccuracy = Number(formData.get("gpsAccuracyMeters"));
  const gpsCapturedAt = parseDate(formData.get("gpsCapturedAt"));

  if (
    !Number.isFinite(rawGpsLatitude) ||
    !Number.isFinite(rawGpsLongitude) ||
    !isValidLatitude(rawGpsLatitude) ||
    !isValidLongitude(rawGpsLongitude) ||
    !Number.isFinite(rawGpsAccuracy) ||
    rawGpsAccuracy <= 0 ||
    !gpsCapturedAt
  ) {
    return {
      code: "gps_required",
      error: "A recent GPS fix with timestamp and accuracy is required.",
    };
  }

  const gpsLatitude = roundCoordinate(rawGpsLatitude);
  const gpsLongitude = roundCoordinate(rawGpsLongitude);
  const gpsAccuracyMeters = Math.round(rawGpsAccuracy * 10) / 10;

  if (!isWithinBulacan(gpsLatitude, gpsLongitude)) {
    return { code: "gps_outside_scope", error: "Your GPS fix must be inside Bulacan." };
  }

  if (!isFresh(gpsCapturedAt, ONSITE_REPORT_POLICY.maximumGpsAgeMs, now)) {
    return { code: "gps_stale", error: "Your GPS fix is too old. Refresh your current location." };
  }

  if (gpsAccuracyMeters > ONSITE_REPORT_POLICY.maximumGpsAccuracyMeters) {
    return {
      code: "gps_inaccurate",
      error: `GPS accuracy must be ${ONSITE_REPORT_POLICY.maximumGpsAccuracyMeters} m or better. Move to an open area and try again.`,
    };
  }

  if (distanceToBulacanBoundaryMeters(gpsLatitude, gpsLongitude) <= gpsAccuracyMeters) {
    return {
      code: "border_review_required",
      error:
        "The GPS accuracy area crosses the Bulacan boundary. Ask an administrator to review a legitimate border report.",
    };
  }

  const photoCapturedAt = parseDate(formData.get("photoCapturedAt"));

  if (!photoCapturedAt) {
    return {
      code: "photo_time_required",
      error: "The required photo must be captured during this report.",
    };
  }

  if (!isFresh(photoCapturedAt, ONSITE_REPORT_POLICY.maximumPhotoAgeMs, now)) {
    return { code: "photo_stale", error: "The captured photo is too old. Take a new photo." };
  }

  const distanceMeters = calculateDistanceMeters(
    { latitude: gpsLatitude, longitude: gpsLongitude },
    { latitude: input.reportLatitude, longitude: input.reportLongitude },
  );
  const maximumDistanceMeters =
    ONSITE_REPORT_POLICY.baseFixToReportDistanceMeters + gpsAccuracyMeters;

  if (distanceMeters > maximumDistanceMeters) {
    return {
      code: "location_too_far",
      error: `The reported point must be within ${Math.round(maximumDistanceMeters)} m of your GPS fix.`,
    };
  }

  return {
    data: {
      gpsLatitude,
      gpsLongitude,
      gpsAccuracyMeters,
      gpsCapturedAt,
      photoCapturedAt,
      policyVersion: ONSITE_REPORT_POLICY.version,
    },
  };
}
