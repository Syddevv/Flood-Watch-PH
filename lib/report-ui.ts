import {
  deriveCommunityStatus,
  formatRelativeTime,
  getReportCategoryLabel,
  getReportSeverityTone,
  getSourceLabel,
  toCoordinatesLabel,
} from "@/lib/reporting";
import type { AlertSeverity, IncidentReport, IncidentReportStatus } from "@/lib/types";

import type { ReportRecord } from "./report-types";

export const severityBadgeClasses: Record<AlertSeverity, string> = {
  safe: "border-[rgba(34,197,94,0.34)] bg-[rgba(34,197,94,0.08)] text-[var(--color-success)]",
  moderate:
    "border-[rgba(245,158,11,0.34)] bg-[rgba(245,158,11,0.08)] text-[var(--color-warning)]",
  high: "border-[rgba(249,115,22,0.34)] bg-[rgba(249,115,22,0.08)] text-[var(--color-high)]",
  severe:
    "border-[rgba(239,68,68,0.34)] bg-[rgba(239,68,68,0.08)] text-[var(--color-danger)]",
};

export const severityLabels: Record<AlertSeverity, string> = {
  safe: "Low",
  moderate: "Moderate",
  high: "High",
  severe: "Critical",
};

export function buildStoredActionKey(type: "confirmed" | "resolved", reportId: string) {
  return `${type}_report_${reportId}`;
}

export function getStatusPresentation(status: IncidentReportStatus) {
  if (status === "Resolved") {
    return {
      dotClassName: "bg-slate-400",
      textClassName: "text-slate-500",
      wrapperClassName: "bg-[rgba(148,163,184,0.08)]",
      label: "Resolved",
    };
  }

  if (status === "Likely Resolved") {
    return {
      dotClassName: "bg-[#475569]",
      textClassName: "text-[#475569]",
      wrapperClassName: "bg-[rgba(71,85,105,0.08)]",
      label: "Likely Resolved",
    };
  }

  if (status === "Confirmed by Community") {
    return {
      dotClassName: "bg-[#22c55e]",
      textClassName: "text-[#22c55e]",
      wrapperClassName: "bg-[rgba(34,197,94,0.08)]",
      label: "Confirmed by Community",
    };
  }

  return {
    dotClassName: "bg-[var(--color-warning)]",
    textClassName: "text-[var(--color-warning)]",
    wrapperClassName: "bg-[rgba(245,158,11,0.08)]",
    label: "Needs More Confirmation",
  };
}

function createReportPhotos(report: ReportRecord) {
  if (!report.imageUrl) {
    return [];
  }

  return [
    {
      id: `${report.id}-image`,
      label: report.title,
      imageUrl: report.imageUrl,
    },
  ];
}

export function mapReportToIncident(report: ReportRecord): IncidentReport {
  const severityTone = getReportSeverityTone(report.severity);
  const derivedStatus = deriveCommunityStatus({
    status: report.status,
    confirmationCount: report.confirmationCount,
    resolvedCount: report.resolvedCount,
    resolvedAt: report.resolvedAt,
  });

  return {
    id: report.id,
    title: report.title,
    location: report.locationName,
    coordinatesLabel: toCoordinatesLabel(report.latitude, report.longitude),
    coordinates: [report.latitude, report.longitude],
    category: getReportCategoryLabel(report.category),
    severity: severityTone,
    status: derivedStatus,
    description: report.description,
    createdAt: report.createdAt,
    reportedAgo: formatRelativeTime(report.createdAt),
    confirmations: report.confirmationCount,
    resolvedConfirmations: report.resolvedCount,
    sourceType: report.sourceType,
    resolvedAgo:
      derivedStatus === "Resolved" || report.resolvedAt
        ? `Resolved ${formatRelativeTime(report.resolvedAt ?? report.updatedAt)}`
        : derivedStatus === "Likely Resolved"
          ? `Likely resolved ${formatRelativeTime(report.updatedAt)}`
          : undefined,
    reporter: report.reportedByName ?? "Anonymous Community Reporter",
    sourceUnit: getSourceLabel(report.sourceType),
    photos: createReportPhotos(report),
  };
}
