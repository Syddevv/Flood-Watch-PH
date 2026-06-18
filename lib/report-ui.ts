import {
  deriveCommunityStatus,
  formatCountLabel,
  formatRelativeTime,
  getReportCategoryLabel,
  getReportSeverityTone,
  getSourceLabel,
  toCoordinatesLabel,
} from "@/lib/reporting";
import {
  getSourceCategoryFromReportType,
  getSourceLabelFromReportType,
} from "@/lib/source-metadata";
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
      label: "Marked receded",
    };
  }

  if (status === "Likely Receded") {
    return {
      dotClassName: "bg-[#475569]",
      textClassName: "text-[#475569]",
      wrapperClassName: "bg-[rgba(71,85,105,0.08)]",
      label: "Likely receded",
    };
  }

  if (status === "Confirmed by Community") {
    return {
      dotClassName: "bg-[#22c55e]",
      textClassName: "text-[#22c55e]",
      wrapperClassName: "bg-[rgba(34,197,94,0.08)]",
      label: "Community confirmed",
    };
  }

    return {
      dotClassName: "bg-[var(--color-warning)]",
      textClassName: "text-[var(--color-warning)]",
      wrapperClassName: "bg-[rgba(245,158,11,0.08)]",
      label: "Recently reported",
    };
}

export function getReportCommunitySummary(report: Pick<IncidentReport, "confirmations" | "resolvedConfirmations">) {
  return `Confirmed by ${formatCountLabel(report.confirmations)} · ${formatCountLabel(report.resolvedConfirmations, "person", "people")} marked receded`;
}

export function getReportCommunitySignal(report: Pick<IncidentReport, "status" | "resolvedConfirmations">) {
  if (report.status === "Likely Receded") {
    return `Likely receded based on ${formatCountLabel(report.resolvedConfirmations, "community report", "community reports")}.`;
  }

  if (report.status === "Resolved") {
    return `Marked receded by ${formatCountLabel(report.resolvedConfirmations, "community report", "community reports")}.`;
  }

  if (report.status === "Confirmed by Community") {
    return `Confirmed by multiple users. Continue following LGU and PAGASA advisories.`;
  }

  return "Community reports are not official advisories. Follow LGU and PAGASA updates.";
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
    severity: report.severity,
    confirmationCount: report.confirmationCount,
    resolvedCount: report.resolvedCount,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    lastActivityAt: report.lastActivityAt,
    resolvedAt: report.resolvedAt,
    archivedAt: report.archivedAt,
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
    updatedAt: report.updatedAt,
    lastActivityAt: report.lastActivityAt,
    archivedAt: report.archivedAt,
    resolvedAt: report.resolvedAt,
    reportedAgo: formatRelativeTime(report.createdAt),
    lastActivityAgo: formatRelativeTime(report.lastActivityAt),
    confirmations: report.confirmationCount,
    resolvedConfirmations: report.resolvedCount,
    lastConfirmedAt: report.lastConfirmedAt ?? null,
    lastResolvedConfirmationAt: report.lastResolvedConfirmationAt ?? null,
    sourceType: report.sourceType,
    sourceCategory: getSourceCategoryFromReportType(report.sourceType),
    sourceLabel: getSourceLabelFromReportType(report.sourceType),
    resolvedAgo:
      derivedStatus === "Resolved" || report.resolvedAt
        ? `Resolved ${formatRelativeTime(report.resolvedAt ?? report.updatedAt)}`
        : derivedStatus === "Likely Receded"
          ? `Likely receded ${formatRelativeTime(report.updatedAt)}`
          : undefined,
    reporter: report.reportedByName ?? "Anonymous Community Reporter",
    sourceUnit: getSourceLabel(report.sourceType),
    officialSource:
      report.officialSourceName ||
      report.officialSourceUrl ||
      report.officialIssuedAt ||
      report.officialValidUntil ||
      report.officialArea ||
      report.officialSummary
        ? {
            officialSourceName: report.officialSourceName ?? undefined,
            officialSourceUrl: report.officialSourceUrl ?? undefined,
            officialIssuedAt: report.officialIssuedAt ?? undefined,
            officialValidUntil: report.officialValidUntil ?? undefined,
            officialArea: report.officialArea ?? undefined,
            officialSummary: report.officialSummary ?? undefined,
          }
        : undefined,
    photos: createReportPhotos(report),
  };
}
