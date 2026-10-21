import { clampLimit, parsePositiveInteger } from "@/lib/api-utils";

export const ADMIN_REPORT_STATUSES = [
  "pending",
  "under_review",
  "verified",
  "responding",
  "resolved",
  "rejected",
  "closed",
] as const;

export type AdminReportStatus = (typeof ADMIN_REPORT_STATUSES)[number];

export function publicStatusForOperationalAction(next: AdminReportStatus, confirmationCount: number) {
  if (next === "resolved") return "Resolved";
  if (next === "closed") return "Archived";
  return confirmationCount >= 2 ? "Confirmed by Community" : "Needs More Confirmation";
}

export const ADMIN_REPORT_STATUS_TRANSITIONS: Readonly<
  Record<AdminReportStatus, readonly AdminReportStatus[]>
> = {
  pending: ["under_review", "closed"],
  under_review: ["pending", "responding", "closed"],
  verified: ["under_review", "responding", "resolved", "closed"],
  responding: ["under_review", "resolved", "closed"],
  resolved: ["responding", "closed"],
  rejected: ["under_review", "closed"],
  closed: ["under_review"],
};

export const ADMIN_SETTING_KEYS = [
  "operationsCenterName",
  "publicAdvisoryFooter",
  "notifyCriticalReports",
  "notifyVerificationReminders",
  "notifyCapacityWarnings",
] as const;

export type AdminSettingKey = (typeof ADMIN_SETTING_KEYS)[number];

export const ADMIN_ACTION_TYPES = [
  "status_change",
  "verification",
  "note",
  "assignment",
  "resolution",
] as const;

export type AdminActionType = (typeof ADMIN_ACTION_TYPES)[number];

export const ADMIN_NOTIFICATION_PRIORITIES = [
  "normal",
  "urgent",
  "emergency",
] as const;

export type AdminNotificationPriority =
  (typeof ADMIN_NOTIFICATION_PRIORITIES)[number];

export function isAdminReportStatus(value: string): value is AdminReportStatus {
  return (ADMIN_REPORT_STATUSES as readonly string[]).includes(value);
}

export function canTransitionAdminReportStatus(
  current: AdminReportStatus,
  next: AdminReportStatus,
) {
  return current === next || ADMIN_REPORT_STATUS_TRANSITIONS[current].includes(next);
}

export function inferAdminReportStatus(report: { status: string | null; archivedAt: Date | null; resolvedAt: Date | null }, latestActionStatus?: string | null): AdminReportStatus {
  if (latestActionStatus && isAdminReportStatus(latestActionStatus)) return latestActionStatus;
  if (report.archivedAt || report.status === "Archived") return "closed";
  if (report.resolvedAt || report.status === "Resolved") return "resolved";
  return "pending";
}

export function isAdminSettingKey(value: string): value is AdminSettingKey {
  return (ADMIN_SETTING_KEYS as readonly string[]).includes(value);
}

export function parseAdminPagination(
  params: URLSearchParams,
  options: { maxLimit?: number; defaultLimit?: number } = {},
) {
  const maxLimit = options.maxLimit ?? 50;
  const defaultLimit = options.defaultLimit ?? 20;
  const page = parsePositiveInteger(params.get("page"), 1);
  const requestedLimit = parsePositiveInteger(
    params.get("limit"),
    defaultLimit,
  );

  return {
    page,
    limit: clampLimit(requestedLimit, maxLimit),
  };
}

export function parseExpectedUpdatedAt(value: string | null) {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
