import {
  isValidReportCategory,
  isValidReportSeverity,
  isValidReportSourceType,
  isValidReportStatus,
} from "./validations";

type ReportFilters = {
  status?: string;
  severity?: string;
  category?: string;
  sourceType?: string;
  search?: string;
};

export const MAX_REPORT_SEARCH_LENGTH = 100;
export const MAX_WEATHER_QUERY_LENGTH = 120;
export const MAX_WEATHER_LOCATION_NAME_LENGTH = 160;
export const WEATHER_COORDINATE_PRECISION = 4;

function normalizeString(value: string | null) {
  return value?.trim().replace(/\s+/g, " ") || "";
}

export function normalizeBoundedText(
  value: string | null | undefined,
  maxLength: number,
) {
  const normalized =
    typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  return normalized.length <= maxLength ? normalized : undefined;
}

export function roundWeatherCoordinate(value: number) {
  const factor = 10 ** WEATHER_COORDINATE_PRECISION;
  return Math.round(value * factor) / factor;
}

export function parsePositiveInteger(
  value: string | null,
  fallback: number,
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

export function clampLimit(value: number, max = 50) {
  return Math.min(value, max);
}

export function parseReportFilters(searchParams: URLSearchParams): {
  filters: ReportFilters;
  error?: string;
} {
  const status = normalizeString(searchParams.get("status"));
  const severity = normalizeString(searchParams.get("severity"));
  const category = normalizeString(searchParams.get("category"));
  const sourceType = normalizeString(searchParams.get("sourceType"));
  const search = normalizeString(searchParams.get("search"));

  if (search.length > MAX_REPORT_SEARCH_LENGTH) {
    return {
      filters: {},
      error: `Search must not exceed ${MAX_REPORT_SEARCH_LENGTH} characters.`,
    };
  }

  if (status && !isValidReportStatus(status)) {
    return { filters: {}, error: "Invalid status value." };
  }

  if (severity && !isValidReportSeverity(severity)) {
    return { filters: {}, error: "Invalid severity value." };
  }

  if (category && !isValidReportCategory(category)) {
    return { filters: {}, error: "Invalid category value." };
  }

  if (sourceType && !isValidReportSourceType(sourceType)) {
    return { filters: {}, error: "Invalid sourceType value." };
  }

  return {
    filters: {
      ...(status ? { status } : {}),
      ...(severity ? { severity } : {}),
      ...(category ? { category } : {}),
      ...(sourceType ? { sourceType } : {}),
      ...(search ? { search } : {}),
    },
  };
}

export function trimToUndefined(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
