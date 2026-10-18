import { TERMINAL_RESCUE_STATUSES } from "@/lib/rescue-contracts";

export type RescueEvent = {
  id: string;
  eventType: string;
  nextStatus: string | null;
  createdAt: string;
  note: string | null;
};

export type RescueRecord = {
  id: string;
  reference: string;
  status: string;
  priority: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  forWhom: string;
  primaryContact: string;
  alternateContact: string | null;
  peopleCount: number;
  vulnerabilityTags: string[];
  description: string;
  locationName: string;
  locationUncertainty: string;
  localityCode: string;
  barangay: string;
  linkedReportId: string | null;
  events?: RescueEvent[];
};

export const RESCUE_STATUS_LABELS: Record<string, string> = {
  received: "Request received", triaged: "Under review", assigned: "Coordinator assigned",
  en_route: "Team en route", on_scene: "Team on scene", completed: "Completed",
  cancelled: "Cancelled", rejected: "Not accepted",
};

export function rescueStatusLabel(status: string) {
  return RESCUE_STATUS_LABELS[status] ?? "Status unavailable";
}

export function rescueEventLabel(event: RescueEvent) {
  if (event.eventType === "cancellation_requested") return "Cancellation requested";
  if (event.eventType === "requester_correction") return "Details updated";
  return event.nextStatus ? rescueStatusLabel(event.nextStatus) : "Request updated";
}

export function isTerminalRescue(status: string) {
  return TERMINAL_RESCUE_STATUSES.includes(status);
}

export function shouldPollRescue(records: Pick<RescueRecord, "status">[]) {
  return records.some((record) => !isTerminalRescue(record.status));
}

export async function rescueApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, cache: "no-store", credentials: "same-origin" });
  const envelope = await response.json().catch(() => null) as { data?: T; error?: string } | null;
  if (!response.ok || !envelope?.data) throw new Error(envelope?.error ?? "Rescue service is temporarily unavailable.");
  return envelope.data;
}
