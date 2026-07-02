import type { AlertSeverity, FloodAlert } from "@/lib/types";

export const alertSeverityRank: Record<AlertSeverity, number> = {
  severe: 0,
  high: 1,
  moderate: 2,
  safe: 3,
};

export const alertSeverityBadgeClasses: Record<AlertSeverity, string> = {
  severe: "border-[var(--color-danger-border)] bg-[var(--color-danger-surface)] text-[var(--color-danger-text)]",
  high: "border-[color:var(--severity-high-border)] bg-[color:var(--severity-high-bg)] text-[var(--color-high)]",
  moderate: "border-[var(--color-warning-border)] bg-[var(--color-warning-surface)] text-[var(--color-warning-text)]",
  safe: "border-[var(--color-success-border)] bg-[var(--color-success-surface)] text-[var(--color-success-text)]",
};

export const alertSeverityIconClasses: Record<AlertSeverity, string> = {
  severe: "bg-[var(--color-danger-surface)] text-[var(--color-danger-text)]",
  high: "bg-[color:var(--severity-high-bg)] text-[var(--color-high)]",
  moderate: "bg-[var(--color-warning-surface)] text-[var(--color-warning-text)]",
  safe: "bg-[var(--color-success-surface)] text-[var(--color-success-text)]",
};

export function sortAlertsByPriority(alerts: FloodAlert[]) {
  return [...alerts].sort((left, right) => {
    const severityDifference =
      alertSeverityRank[left.severity] - alertSeverityRank[right.severity];

    if (severityDifference !== 0) {
      return severityDifference;
    }

    return left.location.localeCompare(right.location);
  });
}

export function getAlertRelativeUpdateLabel(alert: FloodAlert) {
  const updatedAt = new Date(alert.updatedAt);

  if (Number.isNaN(updatedAt.getTime())) {
    return `Updated ${alert.updatedAt}`;
  }

  const diffMs = Date.now() - updatedAt.getTime();

  if (!Number.isFinite(diffMs) || diffMs < 60_000) {
    return "Updated just now";
  }

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) {
    return `Updated ${minutes} min${minutes === 1 ? "" : "s"} ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `Updated ${hours} hr${hours === 1 ? "" : "s"} ago`;
  }

  const days = Math.floor(hours / 24);
  return `Updated ${days} day${days === 1 ? "" : "s"} ago`;
}

export function getAlertSummary(alert: FloodAlert) {
  return alert.description.replace(/\s+/g, " ").trim();
}
