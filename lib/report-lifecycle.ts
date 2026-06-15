import type { IncidentReportStatus } from "@/lib/types";

export type ReportLifecycleStatus = IncidentReportStatus | "Archived";

type ReportLifecycleInput = {
  status?: string | null;
  severity: string;
  confirmationCount: number;
  resolvedCount: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  lastActivityAt?: Date | string | null;
  resolvedAt?: Date | string | null;
  archivedAt?: Date | string | null;
};

const RESOLVED_ARCHIVE_WINDOW_MS = 24 * 60 * 60 * 1000;
const LOW_MODERATE_ARCHIVE_WINDOW_MS = 12 * 60 * 60 * 1000;
const HIGH_CRITICAL_ARCHIVE_WINDOW_MS = 24 * 60 * 60 * 1000;

function toDate(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeSeverity(value: string) {
  switch (value) {
    case "Critical":
    case "critical":
    case "severe":
      return "critical";
    case "High":
    case "high":
      return "high";
    case "Moderate":
    case "moderate":
      return "moderate";
    default:
      return "low";
  }
}

export function getLastActivityDate(report: ReportLifecycleInput) {
  return (
    toDate(report.lastActivityAt) ??
    toDate(report.updatedAt) ??
    toDate(report.createdAt) ??
    new Date()
  );
}

export function shouldArchiveResolvedReport(
  report: Pick<ReportLifecycleInput, "resolvedAt" | "archivedAt">,
  now: Date,
) {
  if (toDate(report.archivedAt)) {
    return false;
  }

  const resolvedAt = toDate(report.resolvedAt);
  if (!resolvedAt) {
    return false;
  }

  return now.getTime() - resolvedAt.getTime() >= RESOLVED_ARCHIVE_WINDOW_MS;
}

export function shouldAutoArchiveInactiveReport(
  report: Pick<
    ReportLifecycleInput,
    "severity" | "lastActivityAt" | "updatedAt" | "createdAt" | "resolvedAt" | "archivedAt"
  >,
  now: Date,
) {
  if (toDate(report.archivedAt) || toDate(report.resolvedAt)) {
    return false;
  }

  const lastActivityAt =
    toDate(report.lastActivityAt) ??
    toDate(report.updatedAt) ??
    toDate(report.createdAt);

  if (!lastActivityAt) {
    return false;
  }

  const archiveWindowMs =
    normalizeSeverity(report.severity) === "high" ||
    normalizeSeverity(report.severity) === "critical"
      ? HIGH_CRITICAL_ARCHIVE_WINDOW_MS
      : LOW_MODERATE_ARCHIVE_WINDOW_MS;

  return now.getTime() - lastActivityAt.getTime() >= archiveWindowMs;
}

export function deriveReportLifecycleStatus(
  report: ReportLifecycleInput,
  now = new Date(),
): ReportLifecycleStatus {
  if (
    toDate(report.archivedAt) ||
    report.status === "Archived" ||
    shouldArchiveResolvedReport(report, now) ||
    shouldAutoArchiveInactiveReport(report, now)
  ) {
    return "Archived";
  }

  if (
    report.resolvedCount >= 3 ||
    report.status === "Resolved" ||
    Boolean(toDate(report.resolvedAt))
  ) {
    return "Resolved";
  }

  if (report.resolvedCount >= 2 || report.status === "Likely Resolved" || report.status === "Likely Receded") {
    return "Likely Receded";
  }

  if (report.confirmationCount >= 2 || report.status === "Confirmed by Community") {
    return "Confirmed by Community";
  }

  return "Needs More Confirmation";
}

export function applyReportLifecycleUpdates(
  report: ReportLifecycleInput,
  now = new Date(),
) {
  const resolvedAt = toDate(report.resolvedAt);
  const archivedAt = toDate(report.archivedAt);
  const nextStatus = deriveReportLifecycleStatus(report, now);
  const updates: {
    status: ReportLifecycleStatus;
    resolvedAt?: Date | null;
    archivedAt?: Date | null;
  } = {
    status: nextStatus,
  };

  if (nextStatus === "Resolved" && !resolvedAt) {
    updates.resolvedAt = now;
  }

  if (nextStatus === "Archived" && !archivedAt) {
    updates.archivedAt = now;
  }

  return updates;
}

export function getLifecyclePersistencePatch(
  report: ReportLifecycleInput,
  now = new Date(),
) {
  const nextLifecycle = applyReportLifecycleUpdates(report, now);
  const currentResolvedAt = toDate(report.resolvedAt);
  const currentArchivedAt = toDate(report.archivedAt);
  const patch: {
    status?: ReportLifecycleStatus;
    resolvedAt?: Date | null;
    archivedAt?: Date | null;
  } = {};

  if (report.status !== nextLifecycle.status) {
    patch.status = nextLifecycle.status;
  }

  if (nextLifecycle.resolvedAt && !currentResolvedAt) {
    patch.resolvedAt = nextLifecycle.resolvedAt;
  }

  if (nextLifecycle.archivedAt && !currentArchivedAt) {
    patch.archivedAt = nextLifecycle.archivedAt;
  }

  return patch;
}

export function isActiveLifecycleStatus(status: ReportLifecycleStatus) {
  return (
    status === "Needs More Confirmation" || status === "Confirmed by Community"
  );
}

export function isRecededLifecycleStatus(status: ReportLifecycleStatus) {
  return status === "Likely Receded" || status === "Resolved";
}

export function isVisiblePublicLifecycleStatus(status: ReportLifecycleStatus) {
  return status !== "Archived";
}

export function matchesLifecycleFilter(
  status: ReportLifecycleStatus,
  filter?: string,
) {
  if (!filter || filter === "all") {
    return true;
  }

  if (filter === "active") {
    return isActiveLifecycleStatus(status);
  }

  if (filter === "receded") {
    return status === "Likely Receded";
  }

  if (filter === "resolved") {
    return status === "Resolved";
  }

  if (filter === "archived") {
    return status === "Archived";
  }

  return status === filter;
}
