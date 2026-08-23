import {
  deriveReportLifecycleStatus,
  isActiveLifecycleStatus,
  type ReportLifecycleStatus,
} from "@/lib/report-lifecycle";

type IncidentAggregateInput = Parameters<typeof deriveReportLifecycleStatus>[0];

export type IncidentAggregate = {
  status: ReportLifecycleStatus;
};

const NON_ACTIVE_RANK: Record<string, number> = {
  "Likely Receded": 0,
  Resolved: 1,
  Archived: 2,
};

/**
 * Rolls many constituent reports up into one incident status: an active
 * report always overrides a non-active one (an incident isn't "resolved"
 * while someone is still reporting it as ongoing), and among non-active
 * reports the least-terminal status wins.
 */
export function deriveIncidentAggregate(
  reports: IncidentAggregateInput[],
  now: Date = new Date(),
): IncidentAggregate {
  const statuses = reports.map((report) => deriveReportLifecycleStatus(report, now));
  const activeStatuses = statuses.filter(isActiveLifecycleStatus);

  if (activeStatuses.length > 0) {
    const status = activeStatuses.includes("Confirmed by Community")
      ? "Confirmed by Community"
      : "Needs More Confirmation";
    return { status };
  }

  const leastTerminal = statuses.reduce((current, candidate) =>
    NON_ACTIVE_RANK[candidate] < NON_ACTIVE_RANK[current] ? candidate : current,
  );

  return { status: leastTerminal };
}
