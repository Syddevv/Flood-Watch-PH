import { formatCountLabel, formatRelativeTime } from "@/lib/reporting";

type TrustReportLike = {
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
  lastActivityAt?: string | Date | null;
  lastConfirmedAt?: string | Date | null;
  confirmations?: number;
  confirmationCount?: number;
  resolvedConfirmations?: number;
  resolvedCount?: number;
  severity: string;
  status: string;
};

const THIRTY_MINUTES_MS = 30 * 60 * 1000;
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

function toDate(value?: string | Date | null) {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getAgeMs(value?: string | Date | null, now = new Date()) {
  const date = toDate(value);
  return date ? now.getTime() - date.getTime() : null;
}

function normalizeSeverity(value: string) {
  const normalized = value.trim().toLowerCase();

  if (normalized === "critical" || normalized === "severe") {
    return "critical";
  }

  if (normalized === "high") {
    return "high";
  }

  if (normalized === "moderate") {
    return "moderate";
  }

  return "low";
}

function getConfirmationCount(report: TrustReportLike) {
  return report.confirmations ?? report.confirmationCount ?? 0;
}

function getResolvedCount(report: TrustReportLike) {
  return report.resolvedConfirmations ?? report.resolvedCount ?? 0;
}

export function getReportActivityLabel(report: TrustReportLike) {
  const createdAt = toDate(report.createdAt);
  const lastActivityAt =
    toDate(report.lastActivityAt) ?? toDate(report.updatedAt) ?? createdAt;

  if (!lastActivityAt) {
    return "Reported recently";
  }

  if (!createdAt) {
    return `Updated ${formatRelativeTime(lastActivityAt.toISOString())}`;
  }

  const changedMs = Math.abs(lastActivityAt.getTime() - createdAt.getTime());
  if (changedMs <= 5 * 60 * 1000) {
    return `Reported ${formatRelativeTime(createdAt.toISOString())}`;
  }

  return `Updated ${formatRelativeTime(lastActivityAt.toISOString())}`;
}

export function isRecentlyConfirmedReport(report: TrustReportLike, now = new Date()) {
  const confirmationAgeMs = getAgeMs(report.lastConfirmedAt, now);
  return getConfirmationCount(report) > 0 && confirmationAgeMs !== null && confirmationAgeMs <= SIX_HOURS_MS;
}

export function getReportFreshnessBadge(report: TrustReportLike, now = new Date()) {
  const activityAgeMs =
    getAgeMs(report.lastActivityAt, now) ??
    getAgeMs(report.updatedAt, now) ??
    getAgeMs(report.createdAt, now);
  const createdAgeMs = getAgeMs(report.createdAt, now);

  if (report.status === "Resolved" || report.status === "Likely Receded") {
    return null;
  }

  if (isRecentlyConfirmedReport(report, now)) {
    return {
      label: "Recently confirmed",
      tone: "success" as const,
    };
  }

  if (createdAgeMs !== null && createdAgeMs <= THIRTY_MINUTES_MS) {
    return {
      label: "New",
      tone: "info" as const,
    };
  }

  if (activityAgeMs !== null && activityAgeMs >= TWENTY_FOUR_HOURS_MS) {
    return {
      label: "Likely outdated",
      tone: "muted" as const,
    };
  }

  if (activityAgeMs !== null && activityAgeMs >= TWELVE_HOURS_MS) {
    return {
      label: "Needs update",
      tone: "warning" as const,
    };
  }

  if (activityAgeMs !== null && activityAgeMs <= SIX_HOURS_MS) {
    return {
      label: "Recent",
      tone: "neutral" as const,
    };
  }

  return null;
}

export function getReportTrustSummary(report: TrustReportLike) {
  const confirmations = getConfirmationCount(report);
  const resolved = getResolvedCount(report);

  if (confirmations > 0 && resolved > 0) {
    return `Mixed updates: ${formatCountLabel(confirmations)} confirmed · ${formatCountLabel(resolved)} marked receded`;
  }

  if (confirmations > 1) {
    return `${formatCountLabel(confirmations)} confirmations`;
  }

  if (confirmations === 1) {
    return "Confirmed by community";
  }

  return "Reported by community";
}

export function getReportTrustDetail(report: TrustReportLike) {
  if (report.lastConfirmedAt && getConfirmationCount(report) > 0) {
    return `Last confirmed ${formatRelativeTime(report.lastConfirmedAt)}`;
  }

  if (getResolvedCount(report) > 0) {
    return `${formatCountLabel(getResolvedCount(report))} marked receded`;
  }

  return "No recent community confirmation";
}

export function getReportSortPriority(report: TrustReportLike, now = new Date()) {
  const severity = normalizeSeverity(report.severity);
  const freshnessBadge = getReportFreshnessBadge(report, now);

  if (report.status === "Needs More Confirmation" || report.status === "Confirmed by Community") {
    if (severity === "critical") {
      return 0;
    }

    if (isRecentlyConfirmedReport(report, now)) {
      return 1;
    }

    const createdAgeMs = getAgeMs(report.createdAt, now);
    if (createdAgeMs !== null && createdAgeMs <= THIRTY_MINUTES_MS) {
      return 2;
    }

    if (severity === "high") {
      return 3;
    }

    if (freshnessBadge?.label === "Needs update" || freshnessBadge?.label === "Likely outdated") {
      return 5;
    }

    return 4;
  }

  return 6;
}

export function compareReportsByPriority<T extends TrustReportLike>(left: T, right: T) {
  const now = new Date();
  const priorityDifference = getReportSortPriority(left, now) - getReportSortPriority(right, now);
  if (priorityDifference !== 0) {
    return priorityDifference;
  }

  const leftActivity =
    toDate(left.lastActivityAt)?.getTime() ??
    toDate(left.updatedAt)?.getTime() ??
    toDate(left.createdAt)?.getTime() ??
    0;
  const rightActivity =
    toDate(right.lastActivityAt)?.getTime() ??
    toDate(right.updatedAt)?.getTime() ??
    toDate(right.createdAt)?.getTime() ??
    0;

  if (leftActivity !== rightActivity) {
    return rightActivity - leftActivity;
  }

  const leftConfirmations = getConfirmationCount(left);
  const rightConfirmations = getConfirmationCount(right);

  if (leftConfirmations !== rightConfirmations) {
    return rightConfirmations - leftConfirmations;
  }

  return getResolvedCount(right) - getResolvedCount(left);
}
