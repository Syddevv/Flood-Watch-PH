import type { IncidentReportStatus } from "@/lib/types";
import { ADMIN_SETTINGS_DEFAULTS, type AdminSettingsValues } from "@/lib/admin-settings-config";

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

export type ReportVisibilitySettings = Pick<AdminSettingsValues, "publicReportVisibilityHours" | "showLikelyRecededReports" | "autoArchiveExpiredReports">;
export const DEFAULT_REPORT_VISIBILITY_SETTINGS: ReportVisibilitySettings = ADMIN_SETTINGS_DEFAULTS;

function toDate(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getLastActivityDate(report: ReportLifecycleInput) {
  return (
    toDate(report.lastActivityAt) ??
    toDate(report.updatedAt) ??
    toDate(report.createdAt) ??
    new Date()
  );
}

export function hasReportVisibilityExpired(report: Pick<ReportLifecycleInput, "createdAt">, now = new Date(), settings: ReportVisibilitySettings = DEFAULT_REPORT_VISIBILITY_SETTINGS) {
  const createdAt = toDate(report.createdAt);
  return !createdAt || now.getTime() - createdAt.getTime() >= settings.publicReportVisibilityHours * 60 * 60 * 1000;
}

export function deriveReportLifecycleStatus(
  report: ReportLifecycleInput,
  now = new Date(),
  settings: ReportVisibilitySettings = DEFAULT_REPORT_VISIBILITY_SETTINGS,
): ReportLifecycleStatus {
  if (
    toDate(report.archivedAt) ||
    report.status === "Archived" ||
    (settings.autoArchiveExpiredReports && hasReportVisibilityExpired(report, now, settings))
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
  settings: ReportVisibilitySettings = DEFAULT_REPORT_VISIBILITY_SETTINGS,
) {
  const resolvedAt = toDate(report.resolvedAt);
  const archivedAt = toDate(report.archivedAt);
  const nextStatus = deriveReportLifecycleStatus(report, now, settings);
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
  settings: ReportVisibilitySettings = DEFAULT_REPORT_VISIBILITY_SETTINGS,
) {
  const nextLifecycle = applyReportLifecycleUpdates(report, now, settings);
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

function isWithinPublicReportWindow(report: ReportLifecycleInput, now: Date, settings: ReportVisibilitySettings) {
  const status = deriveReportLifecycleStatus(report, now, settings);
  return !hasReportVisibilityExpired(report, now, settings) &&
    isVisiblePublicLifecycleStatus(status) &&
    (settings.showLikelyRecededReports || status !== "Likely Receded");
}

export function isEligiblePublicReport(report: ReportLifecycleInput & { verificationStatus?: string | null }, now = new Date(), settings: ReportVisibilitySettings = DEFAULT_REPORT_VISIBILITY_SETTINGS) {
  return report.verificationStatus === "verified" && isWithinPublicReportWindow(report, now, settings);
}

export function isEligiblePublicMapReport(report: ReportLifecycleInput & { verificationStatus?: string | null }, now = new Date(), settings: ReportVisibilitySettings = DEFAULT_REPORT_VISIBILITY_SETTINGS) {
  return (report.verificationStatus === "verified" || report.verificationStatus === "unreviewed") &&
    isWithinPublicReportWindow(report, now, settings);
}

export function matchesLifecycleFilter(
  status: ReportLifecycleStatus,
  filter?: string,
) {
  if (!filter || filter === "all") {
    return true;
  }

  if (filter === "active") {
    return isActiveLifecycleStatus(status) || status === "Likely Receded";
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
