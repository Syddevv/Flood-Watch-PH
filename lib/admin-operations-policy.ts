export const RECENT_REPORT_WINDOW_MS = 72 * 60 * 60 * 1000;
export const MONITORING_REPORT_STATUSES = ["Needs More Confirmation", "Confirmed by Community"] as const;

export function isRecentOperationalReport(report: { createdAt: string }, now: number, windowMs = RECENT_REPORT_WINDOW_MS) {
  const submittedAt = Date.parse(report.createdAt);
  return Number.isFinite(submittedAt) && submittedAt <= now && submittedAt >= now - windowMs;
}

export function matchesOperationsReportView(
  report: { createdAt: string; verificationStatus: string },
  view: "recent" | "pending" | "verified" | "all",
  now: number,
  windowMs = RECENT_REPORT_WINDOW_MS,
) {
  if (view === "recent") return isRecentOperationalReport(report, now, windowMs);
  if (view === "pending") return report.verificationStatus === "unreviewed";
  if (view === "verified") return report.verificationStatus === "verified";
  return true;
}

export function isRecentMonitoringReport(
  report: { createdAt: string; status: string; verificationStatus: string },
  now: number,
  windowMs = RECENT_REPORT_WINDOW_MS,
) {
  return isRecentOperationalReport(report, now, windowMs) &&
    report.verificationStatus !== "rejected" &&
    MONITORING_REPORT_STATUSES.some((status) => status === report.status);
}

export function compactBulacanPlace(place: string) {
  const parts = place.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.at(-1)?.toLocaleLowerCase("en-PH") === "bulacan") parts.pop();
  return parts.slice(-2).join(", ") || place;
}

export function relativeOperationalTime(value: string, now: number) {
  const elapsed = Math.max(0, now - Date.parse(value));
  if (!Number.isFinite(elapsed)) return "Time unavailable";
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months < 12 ? `${months} months ago` : `${Math.floor(months / 12)} years ago`;
}
