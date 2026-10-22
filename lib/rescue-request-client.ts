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
  workflowVersion: number;
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
  received: "Request received", under_review: "Under review", awaiting_responder: "Awaiting responder confirmation",
  responder_confirmed: "Responder acceptance recorded by admin", dispatched: "Dispatch confirmation recorded by admin",
  en_route: "Departure reported to admin", on_scene: "Arrival reported to admin", resolved: "Resolution recorded by admin", closed: "Closed",
  cancelled: "Cancelled", duplicate: "Marked as duplicate", referred: "Referred", unable_to_contact: "Unable to contact",
  triaged: "Under review (legacy)", assigned: "Coordinator assigned (legacy)",
  completed: "Completed (legacy)", rejected: "Not accepted (legacy)",
};

export function rescueStatusLabel(status: string, workflowVersion = 1) {
  if (workflowVersion === 1 && status === "en_route") return "Previously marked en route (legacy)";
  if (workflowVersion === 1 && status === "on_scene") return "Previously marked on scene (legacy)";
  return RESCUE_STATUS_LABELS[status] ?? "Status unavailable";
}

export function rescueEventLabel(event: RescueEvent, workflowVersion = 1) {
  if (event.eventType === "cancellation_requested") return "Cancellation requested";
  if (event.eventType === "requester_correction") return "Details updated";
  if (event.eventType === "note") return "Update from operations";
  return event.nextStatus ? rescueStatusLabel(event.nextStatus, event.eventType === "transition" ? 1 : workflowVersion) : "Request updated";
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
