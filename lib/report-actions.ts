import type { IncidentReport } from "@/lib/types";

export type ReportActionType = "confirmed" | "resolved";

export type ReportActionLoadingState = {
  reportId: string;
  type: ReportActionType;
} | null;

export const REPORT_ACTION_MESSAGES = {
  confirmedSuccess: "Thanks. Your confirmation helps others nearby.",
  resolvedSuccess: "Thanks. Your update helps mark this area as receding.",
  duplicate: "You have already submitted this update from this browser.",
  undoSuccess: "Your action was undone.",
  error: "Unable to update this report. Please try again.",
} as const;

export function isReportActionLoading(
  loading: ReportActionLoadingState,
  reportId: string,
  type?: ReportActionType,
) {
  return Boolean(
    loading &&
      loading.reportId === reportId &&
      (!type || loading.type === type),
  );
}

export function getReportActionLabel({
  type,
  loading,
  alreadySubmitted,
  compact = false,
}: {
  type: ReportActionType;
  loading: boolean;
  alreadySubmitted: boolean;
  compact?: boolean;
}) {
  if (loading) {
    return type === "confirmed" ? "Confirming..." : "Marking...";
  }

  if (type === "confirmed") {
    return alreadySubmitted ? "Confirmed" : compact ? "Confirm" : "Confirm Report";
  }

  return alreadySubmitted ? "Marked" : compact ? "Receded" : "Water Receded";
}

export function hasReportCoordinates(report: Pick<IncidentReport, "coordinates"> | null) {
  return Boolean(
    report &&
      Array.isArray(report.coordinates) &&
      report.coordinates.length === 2 &&
      Number.isFinite(report.coordinates[0]) &&
      Number.isFinite(report.coordinates[1]),
  );
}

export function buildReportDirectionsUrl(report: Pick<IncidentReport, "coordinates">) {
  if (!hasReportCoordinates(report)) {
    return null;
  }

  const [lat, lng] = report.coordinates as [number, number];
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    `${lat},${lng}`,
  )}`;
}

export function buildReportUpdateHref(report: Pick<IncidentReport, "id" | "coordinates" | "location">) {
  const params = new URLSearchParams({
    mode: "update",
    reportId: report.id,
  });

  if (report.location) {
    params.set("location", report.location);
  }

  if (hasReportCoordinates(report)) {
    const [lat, lng] = report.coordinates as [number, number];
    params.set("lat", String(lat));
    params.set("lng", String(lng));
  }

  return `/incident-reports?${params.toString()}`;
}

export function buildReportEvacuationCentersHref(
  report: Pick<IncidentReport, "id" | "coordinates">,
) {
  if (!hasReportCoordinates(report)) {
    return null;
  }

  const [lat, lng] = report.coordinates as [number, number];
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    fromReport: report.id,
  });

  return `/evacuation-centers?${params.toString()}`;
}
