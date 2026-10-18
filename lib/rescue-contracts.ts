import { BULACAN_LOCALITIES } from "@/data/bulacan-localities";
import { isWithinBulacan } from "@/lib/bulacan-scope";

export const RESCUE_STATUSES = ["received", "triaged", "assigned", "en_route", "on_scene", "completed", "cancelled", "rejected"] as const;
export type RescueStatus = (typeof RESCUE_STATUSES)[number];
export type RescuePriority = "routine" | "urgent" | "critical";
export const TERMINAL_RESCUE_STATUSES: readonly string[] = ["completed", "cancelled", "rejected"];

export const RESCUE_TRANSITIONS: Record<RescueStatus, readonly RescueStatus[]> = {
  received: ["triaged", "rejected", "cancelled"],
  triaged: ["assigned", "rejected", "cancelled"],
  assigned: ["en_route", "triaged", "cancelled"],
  en_route: ["on_scene", "triaged"],
  on_scene: ["completed", "triaged"],
  completed: [], cancelled: [], rejected: [],
};

export function canTransitionRescue(current: string, next: string) {
  return current in RESCUE_TRANSITIONS && RESCUE_TRANSITIONS[current as RescueStatus].includes(next as RescueStatus);
}

export class RescueError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

function text(value: unknown, max: number, required = false) {
  if (value === undefined || value === null || value === "") {
    if (required) throw new RescueError("Required rescue details are missing.", 400);
    return null;
  }
  if (typeof value !== "string" || value.length > max || value.trim().length === 0) throw new RescueError("Invalid rescue details.", 400);
  return value.trim();
}

function optionalCoordinate(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new RescueError("Invalid rescue coordinates.", 400);
  return value;
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RescueError("Invalid rescue request.", 400);
  return value as Record<string, unknown>;
}

export function parseRescueIntake(value: unknown) {
  const input = object(value);
  const allowed = ["forWhom", "assistedPersonName", "relationship", "primaryContact", "alternateContact", "peopleCount", "vulnerabilityTags", "vulnerabilityNotes", "description", "locationName", "latitude", "longitude", "locationUncertainty", "localityCode", "barangay", "linkedReportId", "intakeChannel", "assistedIntakeMethod", "priority", "requesterUserId", "linkConsentConfirmed"];
  if (Object.keys(input).some((key) => !allowed.includes(key))) throw new RescueError("Invalid rescue intake fields.", 400);
  const localityCode = text(input.localityCode, 10, true)!;
  if (!BULACAN_LOCALITIES.some((locality) => locality.code === localityCode)) throw new RescueError("Select a Bulacan city or municipality.", 400);
  const latitude = optionalCoordinate(input.latitude);
  const longitude = optionalCoordinate(input.longitude);
  if ((latitude === null) !== (longitude === null) || (latitude !== null && longitude !== null && !isWithinBulacan(latitude, longitude))) throw new RescueError("The rescue location must be within Bulacan.", 400);
  const locationUncertainty = text(input.locationUncertainty, 10, true)!;
  if (!["gps", "map", "manual"].includes(locationUncertainty) || (locationUncertainty !== "manual" && latitude === null)) throw new RescueError("Invalid location source.", 400);
  const forWhom = text(input.forWhom, 10, true)!;
  if (forWhom !== "self" && forWhom !== "other") throw new RescueError("Choose who needs rescue.", 400);
  const peopleCount = input.peopleCount;
  if (!Number.isInteger(peopleCount) || (peopleCount as number) < 1 || (peopleCount as number) > 1000) throw new RescueError("Enter a valid people count.", 400);
  const vulnerabilityTags = input.vulnerabilityTags ?? [];
  if (!Array.isArray(vulnerabilityTags) || vulnerabilityTags.length > 12 || vulnerabilityTags.some((tag) => typeof tag !== "string" || tag.length > 40 || !/^[a-z][a-z_-]*$/.test(tag))) throw new RescueError("Invalid needs selection.", 400);
  const assistedPersonName = text(input.assistedPersonName, 120);
  const relationship = text(input.relationship, 80);
  if (forWhom === "other" && !relationship) throw new RescueError("Describe your relationship to the person needing help.", 400);
  const assistedIntakeMethod = text(input.assistedIntakeMethod, 20);
  if (assistedIntakeMethod && !["phone", "walk_in", "other"].includes(assistedIntakeMethod)) throw new RescueError("Choose a valid assisted intake method.", 400);
  const priority = text(input.priority, 20) ?? "routine";
  if (!["routine", "urgent", "critical"].includes(priority)) throw new RescueError("Choose a valid initial priority.", 400);
  return {
    forWhom, assistedPersonName, relationship,
    primaryContact: text(input.primaryContact, 120, true)!, alternateContact: text(input.alternateContact, 120),
    peopleCount: peopleCount as number, vulnerabilityTags: vulnerabilityTags as string[],
    vulnerabilityNotes: text(input.vulnerabilityNotes, 1000), description: text(input.description, 3000, true)!,
    locationName: text(input.locationName, 240, true)!, latitude, longitude, locationUncertainty,
    localityCode, barangay: text(input.barangay, 120, true)!, linkedReportId: text(input.linkedReportId, 100),
    assistedIntakeMethod, priority,
  };
}

export function parseRescueCorrection(value: unknown) {
  const input = object(value);
  if (!Number.isInteger(input.expectedVersion) || (input.expectedVersion as number) < 1) throw new RescueError("Expected version is required.", 400);
  if (input.action === "cancel") {
    if (Object.keys(input).some((key) => !["action", "expectedVersion"].includes(key))) throw new RescueError("Invalid cancellation fields.", 400);
    return { action: "cancel" as const, expectedVersion: input.expectedVersion as number };
  }
  const allowed = ["expectedVersion", "primaryContact", "alternateContact", "description", "locationName", "latitude", "longitude", "locationUncertainty", "localityCode", "barangay"];
  if (Object.keys(input).some((key) => !allowed.includes(key)) || Object.keys(input).length < 2) throw new RescueError("Only contact, description and location corrections are allowed.", 400);
  const patch: Record<string, unknown> = {};
  for (const key of ["primaryContact", "description", "locationName", "barangay"] as const) if (key in input) patch[key] = text(input[key], key === "description" ? 3000 : 240, true);
  if ("alternateContact" in input) patch.alternateContact = text(input.alternateContact, 120);
  if ("localityCode" in input) {
    const code = text(input.localityCode, 10, true)!;
    if (!BULACAN_LOCALITIES.some((entry) => entry.code === code)) throw new RescueError("Select a Bulacan locality.", 400);
    patch.localityCode = code;
  }
  if ("locationUncertainty" in input) {
    const source = text(input.locationUncertainty, 10, true)!;
    if (!["gps", "map", "manual"].includes(source)) throw new RescueError("Invalid location source.", 400);
    patch.locationUncertainty = source;
  }
  if ("latitude" in input || "longitude" in input) {
    if (!("latitude" in input) || !("longitude" in input)) throw new RescueError("Provide both coordinates.", 400);
    const latitude = optionalCoordinate(input.latitude), longitude = optionalCoordinate(input.longitude);
    if ((latitude === null) !== (longitude === null) || (latitude !== null && longitude !== null && !isWithinBulacan(latitude, longitude))) throw new RescueError("The rescue location must be within Bulacan.", 400);
    patch.latitude = latitude; patch.longitude = longitude;
    if (latitude === null) patch.locationUncertainty = "manual";
  }
  return { action: "correct" as const, expectedVersion: input.expectedVersion as number, patch };
}

export function parseRescueAction(value: unknown) {
  const input = object(value);
  if (!Number.isInteger(input.expectedVersion) || (input.expectedVersion as number) < 1) throw new RescueError("Expected version is required.", 400);
  const action = text(input.action, 30, true)!;
  if (!["transition", "priority", "assign", "note"].includes(action)) throw new RescueError("Invalid rescue action.", 400);
  const nextStatus = text(input.nextStatus, 30);
  const priority = text(input.priority, 20);
  const caseOwnerUserId = text(input.caseOwnerUserId, 100);
  const confirmedTeamReference = text(input.confirmedTeamReference, 160);
  const outcome = text(input.outcome, 1000);
  const reason = text(input.reason, 1000);
  const note = text(input.note, 2000);
  const visibility = text(input.visibility, 10) ?? "internal";
  if (!["public", "internal"].includes(visibility) || (priority && !["routine", "urgent", "critical"].includes(priority))) throw new RescueError("Invalid rescue action details.", 400);
  if (Object.keys(input).some((key) => !["expectedVersion", "action", "nextStatus", "priority", "caseOwnerUserId", "confirmedTeamReference", "outcome", "reason", "note", "visibility"].includes(key))) throw new RescueError("Invalid rescue action fields.", 400);
  if ((action === "transition" && !nextStatus) || (action === "priority" && !priority) || (action === "assign" && !caseOwnerUserId) || (action === "note" && !note)) throw new RescueError("Required action details are missing.", 400);
  if ((action !== "transition" && (nextStatus || confirmedTeamReference || outcome || reason)) ||
      (action !== "priority" && priority) ||
      (action === "note" && caseOwnerUserId) ||
      (action === "priority" && caseOwnerUserId) ||
      (action !== "note" && note)) throw new RescueError("Action fields do not match the selected action.", 400);
  return { expectedVersion: input.expectedVersion as number, action, nextStatus, priority, caseOwnerUserId, confirmedTeamReference, outcome, reason, note, visibility };
}
