import type { PrismaClient } from "@prisma/client";
import { BULACAN_LOCALITIES } from "@/data/bulacan-localities";
import { RescueError } from "@/lib/rescue-contracts";

const localityCodes = new Set<string>(BULACAN_LOCALITIES.map((place) => place.code));

function requiredText(value: unknown, max: number, label: string) {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new RescueError(`Invalid ${label}.`, 400);
  }
  return value.trim();
}

function optionalText(value: unknown, max: number, label: string) {
  if (value == null || value === "") return null;
  return requiredText(value, max, label);
}

function codeList(value: unknown, label: string, valid: (code: string) => boolean) {
  if (!Array.isArray(value) || value.length > 24 || value.some((code) => typeof code !== "string" || !valid(code))) {
    throw new RescueError(`Invalid ${label}.`, 400);
  }
  if (new Set(value).size !== value.length) throw new RescueError(`Duplicate ${label}.`, 400);
  return value as string[];
}

export function parseResponderOrganization(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RescueError("Invalid responder organization.", 400);
  const input = value as Record<string, unknown>;
  const allowed = ["name", "type", "homeLocalityCode", "coverageLocalityCodes", "capabilityCodes", "contactOffice", "contactPerson", "officialPhone", "secondaryContact", "preferredChannel", "demo"];
  if (Object.keys(input).some((key) => !allowed.includes(key))) throw new RescueError("Invalid responder organization fields.", 400);
  const homeLocalityCode = requiredText(input.homeLocalityCode, 10, "home locality");
  if (!localityCodes.has(homeLocalityCode)) throw new RescueError("Select a Bulacan home locality.", 400);
  const coverageLocalityCodes = codeList(input.coverageLocalityCodes, "coverage localities", (code) => localityCodes.has(code));
  if (!coverageLocalityCodes.length || !coverageLocalityCodes.includes(homeLocalityCode)) throw new RescueError("Coverage must include the home locality.", 400);
  const capabilityCodes = codeList(input.capabilityCodes ?? [], "capability codes", (code) => /^[a-z][a-z0-9_]{0,39}$/.test(code));
  const preferredChannel = optionalText(input.preferredChannel, 20, "preferred channel");
  if (preferredChannel && !["phone", "sms_logged", "radio", "other"].includes(preferredChannel)) throw new RescueError("Invalid preferred channel.", 400);
  if (input.demo !== undefined && typeof input.demo !== "boolean") throw new RescueError("Invalid demo flag.", 400);
  return {
    name: requiredText(input.name, 160, "organization name"),
    type: requiredText(input.type, 40, "organization type"),
    homeLocalityCode,
    coverageLocalityCodes,
    capabilityCodes,
    contactOffice: optionalText(input.contactOffice, 160, "contact office"),
    contactPerson: optionalText(input.contactPerson, 160, "contact person"),
    officialPhone: optionalText(input.officialPhone, 80, "official phone"),
    secondaryContact: optionalText(input.secondaryContact, 160, "secondary contact"),
    preferredChannel,
    demo: input.demo === true,
  };
}

export function parseNewResponderOrganization(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RescueError("Invalid responder organization.", 400);
  const { availability = "unknown", contactVerified = false, ...details } = value as Record<string, unknown>;
  const data = parseResponderOrganization(details);
  if (typeof availability !== "string" || !["available", "busy", "unavailable", "unknown"].includes(availability)) throw new RescueError("Invalid availability.", 400);
  if (typeof contactVerified !== "boolean") throw new RescueError("Invalid contact verification.", 400);
  if (contactVerified && !data.officialPhone && !data.secondaryContact) throw new RescueError("Record a contact method before confirming its verification.", 400);
  if (contactVerified && !data.officialPhone && !data.secondaryContact) throw new RescueError("Record a contact method before confirming its verification.", 400);
  if (availability === "available" && (!contactVerified || (!data.officialPhone && !data.secondaryContact))) throw new RescueError("Confirm a recorded contact method before marking available.", 400);
  return { ...data, availability, ...(contactVerified ? { lastContactVerifiedAt: new Date() } : {}) };
}

async function requireAdmin(db: PrismaClient, actorId: string) {
  const actor = await db.user.findUnique({ where: { id: actorId }, select: { role: true } });
  if (actor?.role !== "admin") throw new RescueError("Administrator access required.", 403);
}

export async function createResponderOrganization(db: PrismaClient, actorId: string, input: unknown) {
  const data = parseNewResponderOrganization(input);
  await requireAdmin(db, actorId);
  return db.responderOrganization.create({ data });
}

export async function listResponderOrganizations(db: PrismaClient, actorId: string, params: URLSearchParams) {
  await requireAdmin(db, actorId);
  const search = params.get("search")?.trim() ?? "";
  const locality = params.get("locality") ?? "";
  const capability = params.get("capability")?.trim().toLowerCase() ?? "";
  const availability = params.get("availability") ?? "";
  if (search.length > 100 || (locality && !localityCodes.has(locality)) || (capability && !/^[a-z][a-z0-9_]{0,39}$/.test(capability)) || (availability && !["available", "busy", "unavailable", "unknown"].includes(availability))) throw new RescueError("Invalid directory filters.", 400);
  return db.responderOrganization.findMany({
    where: {
      ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
      ...(locality ? { coverageLocalityCodes: { has: locality } } : {}),
      ...(capability ? { capabilityCodes: { has: capability } } : {}),
      ...(availability ? { availability } : {}),
    },
    orderBy: [{ active: "desc" }, { name: "asc" }, { id: "asc" }], take: 100,
  });
}

export async function getResponderOrganization(db: PrismaClient, actorId: string, id: string) {
  await requireAdmin(db, actorId);
  const organization = await db.responderOrganization.findUnique({ where: { id } });
  if (!organization) throw new RescueError("Responder organization not found.", 404);
  return organization;
}

export async function updateResponderOrganization(db: PrismaClient, actorId: string, id: string, value: unknown) {
  await requireAdmin(db, actorId);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RescueError("Invalid organization update.", 400);
  const input = value as Record<string, unknown>;
  const allowed = ["name", "type", "homeLocalityCode", "coverageLocalityCodes", "capabilityCodes", "contactOffice", "contactPerson", "officialPhone", "secondaryContact", "preferredChannel", "demo", "availability", "active", "contactVerified"];
  if (!Object.keys(input).length || Object.keys(input).some((key) => !allowed.includes(key))) throw new RescueError("Invalid organization update fields.", 400);
  const current = await getResponderOrganization(db, actorId, id);
  const availability = input.availability ?? current.availability;
  if (typeof availability !== "string" || !["available", "busy", "unavailable", "unknown"].includes(availability)) throw new RescueError("Invalid availability.", 400);
  if (input.active !== undefined && typeof input.active !== "boolean") throw new RescueError("Invalid active state.", 400);
  if (input.contactVerified !== undefined && typeof input.contactVerified !== "boolean") throw new RescueError("Invalid contact verification.", 400);
  if (availability === "available" && current.availability !== "available" && input.contactVerified !== true) throw new RescueError("Confirm current contact information before marking available.", 400);
  const parsed = parseResponderOrganization(Object.fromEntries(["name", "type", "homeLocalityCode", "coverageLocalityCodes", "capabilityCodes", "contactOffice", "contactPerson", "officialPhone", "secondaryContact", "preferredChannel", "demo"].map((key) => [key, key in input ? input[key] : current[key as keyof typeof current]])));
  if (input.contactVerified === true && !parsed.officialPhone && !parsed.secondaryContact) throw new RescueError("Record a contact method before confirming its verification.", 400);
  if (input.contactVerified === true && !parsed.officialPhone && !parsed.secondaryContact) throw new RescueError("Record a contact method before confirming its verification.", 400);
  if (availability === "available" && !parsed.officialPhone && !parsed.secondaryContact) throw new RescueError("An available organization needs a recorded contact method.", 400);
  const contactChanged = ["contactOffice", "contactPerson", "officialPhone", "secondaryContact"].some((key) => key in input && parsed[key as keyof typeof parsed] !== current[key as keyof typeof current]);
  return db.responderOrganization.update({ where: { id }, data: { ...parsed, availability, ...(input.active === undefined ? {} : { active: input.active }), ...(input.contactVerified === true ? { lastContactVerifiedAt: new Date() } : contactChanged ? { lastContactVerifiedAt: null } : {}) } });
}

export async function selectResponderAssignment(db: PrismaClient, actorId: string, requestId: string, organizationId: string, expectedVersion: number, overrideReason?: string) {
  const result = await recordRescueCoordination(db, actorId, requestId, { action: "select", expectedVersion, organizationId, ...(overrideReason ? { reason: overrideReason } : {}) });
  return db.rescueAssignment.findUniqueOrThrow({ where: { id: result.assignmentId } });
}

export type CoordinationAction =
  | { action: "select"; expectedVersion: number; organizationId: string; reason?: string }
  | { action: "reassign"; expectedVersion: number; organizationId: string; reason: string }
  | { action: "contact"; expectedVersion: number; channel: "phone" | "sms_logged" | "radio" | "other"; note: string }
  | { action: "acknowledge"; expectedVersion: number; outcome: "accepted" | "declined" | "unreachable" | "unavailable"; note: string };

export function parseCoordinationAction(value: unknown): CoordinationAction {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RescueError("Invalid coordination action.", 400);
  const input = value as Record<string, unknown>;
  if (!Number.isInteger(input.expectedVersion) || (input.expectedVersion as number) < 1) throw new RescueError("Expected request version is required.", 400);
  if (input.action === "select" || input.action === "reassign") {
    if (Object.keys(input).some((key) => !["action", "expectedVersion", "organizationId", "reason"].includes(key))) throw new RescueError("Invalid coordination fields.", 400);
    if (typeof input.organizationId !== "string" || !input.organizationId || input.organizationId.length > 100) throw new RescueError("Select an organization.", 400);
    if (input.reason !== undefined && (typeof input.reason !== "string" || input.reason.trim().length < 10 || input.reason.length > 1000)) throw new RescueError("Record a reason of at least 10 characters.", 400);
    if (input.action === "reassign" && !input.reason) throw new RescueError("Reassignment requires a reason.", 400);
    return input.action === "reassign"
      ? { action: "reassign", expectedVersion: input.expectedVersion as number, organizationId: input.organizationId, reason: (input.reason as string).trim() }
      : { action: "select", expectedVersion: input.expectedVersion as number, organizationId: input.organizationId, reason: (input.reason as string | undefined)?.trim() };
  }
  if (input.action === "contact" || input.action === "acknowledge") {
    if (Object.keys(input).some((key) => !["action", "expectedVersion", "channel", "outcome", "note"].includes(key))) throw new RescueError("Invalid coordination fields.", 400);
    if (typeof input.note !== "string" || input.note.trim().length < 10 || input.note.length > 1000) throw new RescueError("Record a private note of at least 10 characters.", 400);
    if (input.action === "contact") {
      if (!["phone", "sms_logged", "radio", "other"].includes(input.channel as string) || "outcome" in input) throw new RescueError("Choose a contact channel.", 400);
      return { action: "contact", expectedVersion: input.expectedVersion as number, channel: input.channel as "phone" | "sms_logged" | "radio" | "other", note: input.note.trim() };
    }
    if (!["accepted", "declined", "unreachable", "unavailable"].includes(input.outcome as string) || "channel" in input) throw new RescueError("Choose an acknowledgement outcome.", 400);
    return { action: "acknowledge", expectedVersion: input.expectedVersion as number, outcome: input.outcome as "accepted" | "declined" | "unreachable" | "unavailable", note: input.note.trim() };
  }
  throw new RescueError("Invalid coordination action.", 400);
}

export async function recordRescueCoordination(db: PrismaClient, actorId: string, requestId: string, raw: unknown) {
  const input = parseCoordinationAction(raw);
  await requireAdmin(db, actorId);
  try {
    return await db.$transaction(async (tx) => {
      const request = await tx.rescueRequest.findUnique({ where: { id: requestId }, select: { version: true, status: true, localityCode: true } });
      if (!request) throw new RescueError("Rescue request not found.", 404);
      if (request.version !== input.expectedVersion) throw new RescueError("This request changed. Refresh before trying again.", 409);
      if (!["triaged", "assigned"].includes(request.status)) throw new RescueError("Coordination is available after triage and before dispatch.", 400);
      const active = await tx.rescueAssignment.findFirst({ where: { requestId, endedAt: null }, include: { organization: true } });
      let assignmentId: string;
      let eventType: string;
      let note: string | null = null;
      let reason: string | null = null;
      if (input.action === "select" || input.action === "reassign") {
        if (input.action === "select" && active) throw new RescueError("This request already has an active organization.", 409);
        if (input.action === "reassign" && !active) throw new RescueError("No active organization to reassign.", 400);
        if (active?.status === "accepted") throw new RescueError("An accepted assignment needs dispatch review before reassignment.", 400);
        const organization = await tx.responderOrganization.findUnique({ where: { id: input.organizationId } });
        if (!organization?.active || !organization.coverageLocalityCodes.includes(request.localityCode)) throw new RescueError("Organization is inactive or outside its recorded coverage.", 400);
        if (organization.availability === "unavailable") throw new RescueError("An unavailable organization cannot be selected.", 400);
        const verifiedRecently = organization.lastContactVerifiedAt && organization.lastContactVerifiedAt.getTime() >= Date.now() - 7 * 24 * 60 * 60_000;
        if ((organization.availability !== "available" || !verifiedRecently) && !input.reason) throw new RescueError("Record a reason to select an organization with unverified availability.", 400);
        if (active) await tx.rescueAssignment.update({ where: { id: active.id }, data: { status: "ended", endedAt: new Date(), endReason: input.reason } });
        const created = await tx.rescueAssignment.create({ data: { requestId, organizationId: organization.id, recordedByAdminUserId: actorId } });
        assignmentId = created.id; eventType = input.action === "select" ? "organization_selected" : "organization_reassigned"; reason = input.reason?.trim() ?? null;
      } else {
        if (!active) throw new RescueError("Select an organization first.", 400);
        assignmentId = active.id; note = input.note;
        if (input.action === "contact") {
          if (active.status !== "selected") throw new RescueError("This assignment already has a contact attempt.", 409);
          if (!active.organization.active || active.organization.availability === "unavailable") throw new RescueError("This organization is no longer available for contact.", 400);
          if (input.channel === "phone" && !active.organization.officialPhone) throw new RescueError("An official phone number is required for phone contact.", 400);
          if (input.channel === "sms_logged" && !active.organization.officialPhone) throw new RescueError("An official phone number is required for logged SMS.", 400);
          if (input.channel === "radio" && !active.organization.secondaryContact) throw new RescueError("A recorded radio contact is required.", 400);
          if (input.channel === "other" && !active.organization.secondaryContact) throw new RescueError("A recorded secondary contact is required.", 400);
          await tx.rescueAssignment.update({ where: { id: active.id }, data: { status: "awaiting_response", contactChannel: input.channel, contactOutcome: "awaiting_response", contactDetails: note, contactedAt: new Date() } });
          eventType = "contact_attempt_recorded";
        } else {
          if (active.status !== "awaiting_response") throw new RescueError("Record a contact attempt before its outcome.", 400);
          const ended = input.outcome !== "accepted";
          await tx.rescueAssignment.update({ where: { id: active.id }, data: { status: input.outcome, contactOutcome: input.outcome, acknowledgementOutcome: input.outcome, acknowledgedAt: new Date(), ...(ended ? { endedAt: new Date(), endReason: note } : {}) } });
          eventType = "contact_outcome_recorded";
        }
      }
      const updated = await tx.rescueRequest.updateMany({ where: { id: requestId, version: input.expectedVersion }, data: { version: { increment: 1 } } });
      if (updated.count !== 1) throw new RescueError("This request changed. Refresh before trying again.", 409);
      await tx.rescueRequestEvent.create({ data: { requestId, assignmentId, actorUserId: actorId, source: "admin", eventType, previousStatus: request.status, nextStatus: request.status, visibility: "internal", note, reason,
        details: input.action === "contact" ? { channel: input.channel } : input.action === "acknowledge" ? { outcome: input.outcome, adminRecorded: true } : undefined,
      } });
      return { version: input.expectedVersion + 1, assignmentId };
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && ["P2002", "P2034"].includes(String(error.code))) throw new RescueError("This request changed. Refresh before trying again.", 409);
    throw error;
  }
}
