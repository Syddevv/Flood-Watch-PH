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

async function requireAdmin(db: PrismaClient, actorId: string) {
  const actor = await db.user.findUnique({ where: { id: actorId }, select: { role: true } });
  if (actor?.role !== "admin") throw new RescueError("Administrator access required.", 403);
}

// Internal persistence only. Phase 2 will add protected routes and contact policy.
export async function createResponderOrganization(db: PrismaClient, actorId: string, input: unknown) {
  const data = parseResponderOrganization(input);
  await requireAdmin(db, actorId);
  return db.responderOrganization.create({ data });
}

export async function selectResponderAssignment(db: PrismaClient, actorId: string, requestId: string, organizationId: string, expectedVersion: number) {
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) throw new RescueError("Expected request version is required.", 400);
  await requireAdmin(db, actorId);
  try {
    return await db.$transaction(async (tx) => {
      const request = await tx.rescueRequest.findUnique({ where: { id: requestId }, select: { version: true, status: true, localityCode: true } });
      if (!request) throw new RescueError("Rescue request not found.", 404);
      if (request.version !== expectedVersion) throw new RescueError("This request changed. Refresh before trying again.", 409);
      if (!["triaged", "assigned", "awaiting_responder"].includes(request.status)) throw new RescueError("Triage this request before selecting an organization.", 400);
      const organization = await tx.responderOrganization.findUnique({ where: { id: organizationId } });
      if (!organization?.active || !organization.coverageLocalityCodes.includes(request.localityCode)) throw new RescueError("Organization is inactive or outside its recorded coverage.", 400);
      const updated = await tx.rescueRequest.updateMany({ where: { id: requestId, version: expectedVersion }, data: { version: { increment: 1 } } });
      if (updated.count !== 1) throw new RescueError("This request changed. Refresh before trying again.", 409);
      const assignment = await tx.rescueAssignment.create({ data: { requestId, organizationId, recordedByAdminUserId: actorId } });
      await tx.rescueRequestEvent.create({ data: {
        requestId, assignmentId: assignment.id, actorUserId: actorId, source: "admin",
        eventType: "organization_selected", previousStatus: request.status, nextStatus: request.status,
        visibility: "internal",
      } });
      return assignment;
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      throw new RescueError("This request already has an active organization.", 409);
    }
    throw error;
  }
}
