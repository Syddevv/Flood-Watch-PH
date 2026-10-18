import { BULACAN_LOCALITIES } from "@/data/bulacan-localities";
import { RESCUE_STATUSES, RescueError } from "@/lib/rescue-contracts";

// An internal attention cue, not a promised emergency response time.
export const TRIAGE_ATTENTION_MINUTES = 15;

export function parseAdminRescueFilters(params: URLSearchParams) {
  const search = (params.get("search") ?? "").trim();
  const status = params.get("status") ?? "";
  const priority = params.get("priority") ?? "";
  const localityCode = params.get("localityCode") ?? "";
  const sort = params.get("sort") ?? "newest";
  const cursor = params.get("cursor") ?? "";
  if (search.length > 100 || !["", ...RESCUE_STATUSES].includes(status as typeof RESCUE_STATUSES[number]) ||
      !["", "routine", "urgent", "critical"].includes(priority) ||
      (localityCode && !BULACAN_LOCALITIES.some((place) => place.code === localityCode)) ||
      !["newest", "oldest", "locality"].includes(sort) ||
      (cursor && !/^[a-zA-Z0-9_-]{10,100}$/.test(cursor))) {
    throw new RescueError("Invalid rescue queue filter.", 400);
  }
  return { search, status, priority, localityCode, sort, cursor };
}

export function isRescueTriageOverdue(record: { status: string; createdAt: Date }, now = new Date()) {
  return record.status === "received" && record.createdAt.getTime() <= now.getTime() - TRIAGE_ATTENTION_MINUTES * 60_000;
}
