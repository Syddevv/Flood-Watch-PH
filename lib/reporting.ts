import {
  deriveReportLifecycleStatus,
  type ReportLifecycleStatus,
} from "@/lib/report-lifecycle";

const CATEGORY_DISPLAY_LABELS: Record<string, string> = {
  Flood: "Flooding",
  "Road Blocked": "Flooded Road",
  "Rescue Needed": "Evacuation Needed",
  "Damaged Bridge": "Road Not Passable",
};

const CATEGORY_STORAGE_VALUES = new Set([
  "Flood",
  "Road Blocked",
  "Rescue Needed",
  "Overflowing River",
  "Damaged Bridge",
  "Other",
  "Flooding",
  "Flooded Road",
  "Clogged Drainage",
  "Heavy Rainfall",
  "Road Not Passable",
  "Evacuation Needed",
  "Landslide Risk",
]);

export function isSupportedReportCategory(value: string) {
  return CATEGORY_STORAGE_VALUES.has(value);
}

export function getReportCategoryLabel(category: string) {
  return CATEGORY_DISPLAY_LABELS[category] ?? category;
}

export function getReportSeverityTone(severity: string) {
  switch (severity) {
    case "Critical":
      return "severe";
    case "High":
      return "high";
    case "Moderate":
      return "moderate";
    default:
      return "safe";
  }
}

export function deriveCommunityStatus(report: {
  status: string;
  severity?: string;
  confirmationCount: number;
  resolvedCount: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  lastActivityAt?: Date | string | null;
  resolvedAt: Date | string | null;
  archivedAt?: Date | string | null;
}) {
  const derivedStatus = deriveReportLifecycleStatus({
    status: report.status,
    severity: report.severity ?? "Low",
    confirmationCount: report.confirmationCount,
    resolvedCount: report.resolvedCount,
    createdAt: report.createdAt ?? new Date(),
    updatedAt: report.updatedAt ?? report.createdAt ?? new Date(),
    lastActivityAt: report.lastActivityAt ?? report.updatedAt ?? report.createdAt ?? null,
    resolvedAt: report.resolvedAt,
    archivedAt: report.archivedAt ?? null,
  });

  return derivedStatus === "Archived" ? "Resolved" : derivedStatus;
}

export function getPublicReportLifecycleStatus(report: {
  status: string;
  severity: string;
  confirmationCount: number;
  resolvedCount: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  lastActivityAt?: Date | string | null;
  resolvedAt: Date | string | null;
  archivedAt?: Date | string | null;
}): ReportLifecycleStatus {
  return deriveReportLifecycleStatus(report);
}

export function getSourceLabel(sourceType: string) {
  switch (sourceType) {
    case "Official":
      return "Official Report";
    case "System":
      return "System Report";
    default:
      return "Reported by Community";
  }
}

export function formatCountLabel(count: number, singular = "user", plural = "users") {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function formatRelativeTime(dateInput: Date | string) {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const diffMs = Date.now() - date.getTime();

  if (!Number.isFinite(diffMs) || diffMs < 60_000) {
    return "Just now";
  }

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) {
    return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function toCoordinatesLabel(latitude: number, longitude: number) {
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
}
