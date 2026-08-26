/**
 * Report location provenance.
 *
 * A flood report's coordinates can come from four places, and a responder
 * reading the report needs to know which: a GPS fix with a measured accuracy
 * is not the same claim as a number somebody typed into a box. This module
 * defines that vocabulary plus the parsing and labelling around it.
 *
 * Plain TypeScript with no Prisma or `server-only` imports: the report form,
 * the location picker, the API route and the unit tests all share it.
 *
 * Note that accuracy is bound to `source === "gps"` on purpose. Only the
 * Geolocation API measures it; letting any other source carry an accuracy
 * would let a hand-typed coordinate render as a precise instrument reading.
 */

export const REPORT_LOCATION_SOURCES = ["gps", "map", "search", "manual"] as const;

export type ReportLocationSource = (typeof REPORT_LOCATION_SOURCES)[number];

/**
 * Reports created before location provenance existed are backfilled to
 * "manual", and anything unrecognised degrades to it. That is the honest
 * reading: the provenance is unknown, so claim nothing.
 */
export const DEFAULT_REPORT_LOCATION_SOURCE: ReportLocationSource = "manual";

/** Beyond 100 km an "accuracy" reading is noise, not a measurement. */
export const MAX_GPS_ACCURACY_METERS = 100_000;

/** Tolerated clock skew before a client-supplied capture time reads as bogus. */
const MAX_PHOTO_CAPTURE_SKEW_MS = 60_000;

/** A photo older than this is evidence of something other than right now. */
const MAX_PHOTO_CAPTURE_AGE_MS = 24 * 60 * 60 * 1000;

const REPORT_LOCATION_SOURCE_LABELS: Record<ReportLocationSource, string> = {
  gps: "GPS",
  map: "Map pin",
  search: "Search result",
  manual: "Manual entry",
};

function isReportLocationSource(value: string): value is ReportLocationSource {
  return (REPORT_LOCATION_SOURCES as readonly string[]).includes(value);
}

export function parseReportLocationSource(
  raw: FormDataEntryValue | string | null | undefined,
): ReportLocationSource {
  if (typeof raw !== "string") {
    return DEFAULT_REPORT_LOCATION_SOURCE;
  }

  const trimmed = raw.trim();

  return isReportLocationSource(trimmed) ? trimmed : DEFAULT_REPORT_LOCATION_SOURCE;
}

export function parseGpsAccuracyMeters(
  raw: FormDataEntryValue | string | number | null | undefined,
  source: ReportLocationSource,
): number | null {
  if (source !== "gps") {
    return null;
  }

  if (raw === null || raw === undefined || raw === "" || raw instanceof File) {
    return null;
  }

  const parsed = Number(raw);

  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > MAX_GPS_ACCURACY_METERS) {
    return null;
  }

  return Math.round(parsed * 10) / 10;
}

/**
 * The only client-supplied time the system stores. It is descriptive metadata
 * about the photo, never an authority on when the report was filed - that
 * stays the server's `createdAt`. Values outside a sane window are dropped
 * rather than rejected, so a skewed device clock cannot block a submission.
 */
export function parsePhotoCapturedAt(
  raw: FormDataEntryValue | string | null | undefined,
  now: Date,
): Date | null {
  if (typeof raw !== "string" || !raw.trim()) {
    return null;
  }

  const captured = new Date(raw);

  if (Number.isNaN(captured.getTime())) {
    return null;
  }

  const ageMs = now.getTime() - captured.getTime();

  if (ageMs < -MAX_PHOTO_CAPTURE_SKEW_MS || ageMs > MAX_PHOTO_CAPTURE_AGE_MS) {
    return null;
  }

  return captured;
}

export function describeReportLocationSource(source: ReportLocationSource): string {
  return REPORT_LOCATION_SOURCE_LABELS[source];
}

export function formatGpsAccuracyLabel(meters: number | null | undefined): string {
  if (typeof meters !== "number" || !Number.isFinite(meters) || meters <= 0) {
    return "";
  }

  if (meters < 1000) {
    return `±${Math.round(meters)} m`;
  }

  return `±${(meters / 1000).toFixed(1)} km`;
}

export function describeReportLocationProvenance(
  source: ReportLocationSource,
  accuracyMeters: number | null | undefined,
): string {
  const label = describeReportLocationSource(source);
  const accuracyLabel = source === "gps" ? formatGpsAccuracyLabel(accuracyMeters) : "";

  return accuracyLabel ? `${label} · ${accuracyLabel}` : label;
}
