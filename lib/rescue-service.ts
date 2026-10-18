import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma, isPrismaUniqueConstraintError } from "@/lib/prisma";
import { canTransitionRescue, parseRescueIntake, parseRescueCorrection, parseRescueAction, RescueError, TERMINAL_RESCUE_STATUSES } from "@/lib/rescue-contracts";
import { toRescueDto } from "@/lib/rescue-dto";

const events = { orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }] };
const terminal = (status: string) => TERMINAL_RESCUE_STATUSES.includes(status);

export async function createRescueRequest(actorId: string, raw: unknown, idempotencyKey: string | null, admin = false) {
  if (!idempotencyKey || !/^[A-Za-z0-9_-]{16,128}$/.test(idempotencyKey)) throw new RescueError("A valid Idempotency-Key is required.", 400);
  const input = parseRescueIntake(raw);
  const body = raw as Record<string, unknown>;
  const channel = admin ? "admin_assisted" : "public";
  if (admin && body.intakeChannel !== "admin_assisted") throw new RescueError("Admin-assisted intake channel is required.", 400);
  if (!admin && "intakeChannel" in body) throw new RescueError("Intake channel is server-controlled.", 400);
  if (!admin && ("assistedIntakeMethod" in body || "priority" in body)) throw new RescueError("Assisted intake and initial priority are administrator-controlled.", 400);
  if (!admin && "linkConsentConfirmed" in body) throw new RescueError("Linked-report review is administrator-controlled.", 400);
  const requesterUserId = admin ? (typeof body.requesterUserId === "string" ? body.requesterUserId : null) : actorId;
  if (!admin && "requesterUserId" in body) throw new RescueError("Requester identity is server-controlled.", 400);
  if (admin && requesterUserId) {
    const target = await prisma.user.findUnique({ where: { id: requesterUserId }, select: { id: true } });
    if (!target) throw new RescueError("Requester account was not found.", 400);
  }
  if (input.linkedReportId) {
    if (admin && body.linkConsentConfirmed !== true) throw new RescueError("Confirm resident consent and review the linked report before linking it.", 400);
    const report = await prisma.floodReport.findUnique({ where: { id: input.linkedReportId }, select: { id: true, userId: true } });
    if (!report || (!admin && report.userId !== actorId)) throw new RescueError("Linked report is not available.", 404);
  }
  // Keep old idempotency hashes stable when callers omit the additive A3 fields.
  const hashInput = { ...input } as Record<string, unknown>;
  if (!("assistedIntakeMethod" in body)) delete hashInput.assistedIntakeMethod;
  if (!("priority" in body)) delete hashInput.priority;
  const hash = createHash("sha256").update(JSON.stringify({ input: hashInput, requesterUserId, channel, linkConsentConfirmed: admin && body.linkConsentConfirmed === true })).digest("hex");
  const key = { creatorUserId: actorId, intakeChannel: channel, idempotencyKey };
  const existing = await prisma.rescueRequest.findUnique({ where: { creatorUserId_intakeChannel_idempotencyKey: key } });
  if (existing) {
    if (existing.idempotencyHash !== hash) throw new RescueError("This idempotency key was used for another request.", 409);
    return { request: toRescueDto(existing, admin), replayed: true, nearDuplicate: false };
  }
  const nearDuplicate = Boolean(await prisma.rescueRequest.findFirst({ where: {
    requesterUserId, primaryContact: input.primaryContact, localityCode: input.localityCode, locationName: input.locationName,
    createdAt: { gte: new Date(Date.now() - 30 * 60_000) },
  }, select: { id: true } }));
  try {
    const created = await prisma.$transaction(async (tx) => {
      const request = await tx.rescueRequest.create({ data: {
        ...input, reference: `RR-${randomBytes(8).toString("hex").toUpperCase()}`,
        creatorUserId: actorId, requesterUserId, intakeChannel: channel,
        linkedReportConsentConfirmedAt: admin && input.linkedReportId ? new Date() : null,
        idempotencyKey, idempotencyHash: hash,
      } });
      await tx.rescueRequestEvent.create({ data: {
        requestId: request.id, actorUserId: actorId, eventType: "received",
        nextStatus: "received", nextPriority: input.priority, visibility: "public", note: "Request received. Dispatch is not yet confirmed.",
      } });
      return request;
    });
    return { request: toRescueDto(created, admin), replayed: false, nearDuplicate };
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      const replay = await prisma.rescueRequest.findUnique({ where: { creatorUserId_intakeChannel_idempotencyKey: key } });
      if (replay) {
        if (replay.idempotencyHash !== hash) throw new RescueError("This idempotency key was used for another request.", 409);
        return { request: toRescueDto(replay, admin), replayed: true, nearDuplicate: false };
      }
    }
    throw error;
  }
}

export async function listRescueRequests(userId: string, params: URLSearchParams, admin = false) {
  const rawLimit = params.get("limit") ?? "20";
  const limit = Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new RescueError("Invalid page size.", 400);
  const cursor = params.get("cursor");
  if (cursor && !/^[a-zA-Z0-9_-]{10,100}$/.test(cursor)) throw new RescueError("Invalid cursor.", 400);
  if (cursor) {
    const anchor = await prisma.rescueRequest.findFirst({ where: { id: cursor, ...(admin ? {} : { requesterUserId: userId }) }, select: { id: true } });
    if (!anchor) throw new RescueError("Page cursor is unavailable.", 400);
  }
  const status = params.get("status");
  if (status && !["received", "triaged", "assigned", "en_route", "on_scene", "completed", "cancelled", "rejected"].includes(status)) throw new RescueError("Invalid status filter.", 400);
  const where: Prisma.RescueRequestWhereInput = { ...(admin ? {} : { requesterUserId: userId }), ...(status ? { status } : {}) };
  const rows = await prisma.rescueRequest.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
  return { requests: rows.slice(0, limit).map((row) => toRescueDto(row, admin)), nextCursor: rows.length > limit ? rows[limit - 1].id : null };
}

export async function getRescueRequest(id: string, userId: string, admin = false) {
  const record = await prisma.rescueRequest.findFirst({ where: { id, ...(admin ? {} : { requesterUserId: userId }) }, include: { events } });
  if (!record) throw new RescueError("Rescue request not found.", 404);
  return toRescueDto(record, admin);
}

export async function correctRescueRequest(id: string, userId: string, raw: unknown) {
  const input = parseRescueCorrection(raw);
  return prisma.$transaction(async (tx) => {
    const record = await tx.rescueRequest.findFirst({ where: { id, requesterUserId: userId } });
    if (!record) throw new RescueError("Rescue request not found.", 404);
    if (record.version !== input.expectedVersion) throw new RescueError("This request changed. Refresh before trying again.", 409);
    if (terminal(record.status)) throw new RescueError("This request is closed.", 400);
    const cancellationRequested = input.action === "cancel" && !["received", "triaged"].includes(record.status);
    if (input.action === "correct" && !["received", "triaged"].includes(record.status)) throw new RescueError("Corrections are unavailable after assignment.", 400);
    if (input.action === "correct") {
      const source = input.patch.locationUncertainty ?? record.locationUncertainty;
      const latitude = input.patch.latitude === undefined ? record.latitude : input.patch.latitude;
      const longitude = input.patch.longitude === undefined ? record.longitude : input.patch.longitude;
      if (source !== "manual" && (latitude === null || longitude === null)) throw new RescueError("GPS or map locations need coordinates.", 400);
    }
    const data = input.action === "cancel" && !cancellationRequested ? { status: "cancelled" } : input.action === "correct" ? input.patch : {};
    const updated = await tx.rescueRequest.updateMany({ where: { id, version: input.expectedVersion }, data: { ...data, version: { increment: 1 } } });
    if (updated.count !== 1) throw new RescueError("This request changed. Refresh before trying again.", 409);
    await tx.rescueRequestEvent.create({ data: { requestId: id, actorUserId: userId,
      eventType: cancellationRequested ? "cancellation_requested" : input.action === "cancel" ? "cancelled" : "requester_correction",
      previousStatus: record.status, nextStatus: input.action === "cancel" && !cancellationRequested ? "cancelled" : record.status,
      visibility: "public" } });
    return toRescueDto((await tx.rescueRequest.findUniqueOrThrow({ where: { id } })));
  });
}

export async function actOnRescueRequest(id: string, actorId: string, raw: unknown) {
  const input = parseRescueAction(raw);
  return prisma.$transaction(async (tx) => {
    const record = await tx.rescueRequest.findUnique({ where: { id } });
    if (!record) throw new RescueError("Rescue request not found.", 404);
    if (record.version !== input.expectedVersion) throw new RescueError("This request changed. Refresh before trying again.", 409);
    if (terminal(record.status)) throw new RescueError("Terminal requests cannot be changed.", 400);
    const nextStatus = input.action === "transition" ? input.nextStatus! : input.action === "assign" && record.status === "triaged" ? "assigned" : record.status;
    if (input.action === "transition" && !canTransitionRescue(record.status, nextStatus)) throw new RescueError("That status transition is not allowed.", 400);
    if (input.action === "assign" && !["triaged", "assigned"].includes(record.status)) throw new RescueError("Triage before assigning a case owner.", 400);
    if (input.action === "transition" && input.caseOwnerUserId && nextStatus !== "assigned") throw new RescueError("A case owner can only be set during assignment.", 400);
    if (input.confirmedTeamReference && nextStatus !== "en_route") throw new RescueError("A team reference belongs to a confirmed dispatch event.", 400);
    if (input.outcome && nextStatus !== "completed") throw new RescueError("An outcome belongs to completion.", 400);
    if (nextStatus === "assigned" && !(input.caseOwnerUserId ?? record.caseOwnerUserId)) throw new RescueError("A case owner is required for assignment.", 400);
    if (nextStatus === "en_route" && !input.confirmedTeamReference) throw new RescueError("A confirmed dispatch acknowledgment and team reference are required.", 400);
    if (nextStatus === "completed" && !input.outcome) throw new RescueError("Record the rescue outcome.", 400);
    if ((["rejected", "cancelled"].includes(nextStatus) || (nextStatus === "triaged" && record.status !== "received")) && !input.reason) throw new RescueError("A reason is required.", 400);
    if (input.caseOwnerUserId) {
      const owner = await tx.user.findUnique({ where: { id: input.caseOwnerUserId }, select: { role: true } });
      if (owner?.role !== "admin") throw new RescueError("Case owner must be an administrator.", 400);
    }
    const data: Prisma.RescueRequestUncheckedUpdateManyInput = { version: { increment: 1 } };
    if (input.action === "transition" || input.action === "assign") data.status = nextStatus;
    if (input.action === "priority") data.priority = input.priority!;
    if (input.action === "assign" || (input.action === "transition" && input.caseOwnerUserId)) data.caseOwnerUserId = input.caseOwnerUserId;
    if (nextStatus === "en_route") data.confirmedTeamReference = input.confirmedTeamReference;
    if (nextStatus === "completed") data.outcome = input.outcome;
    const updated = await tx.rescueRequest.updateMany({ where: { id, version: input.expectedVersion }, data });
    if (updated.count !== 1) throw new RescueError("This request changed. Refresh before trying again.", 409);
    await tx.rescueRequestEvent.create({ data: { requestId: id, actorUserId: actorId, eventType: input.action,
      previousStatus: record.status, nextStatus, previousPriority: record.priority,
      nextPriority: input.action === "priority" ? input.priority : record.priority,
      previousCaseOwnerUserId: record.caseOwnerUserId,
      nextCaseOwnerUserId: input.caseOwnerUserId ?? record.caseOwnerUserId,
      visibility: input.action === "note" ? input.visibility : "public", reason: input.reason, note: input.note } });
    return toRescueDto(await tx.rescueRequest.findUniqueOrThrow({ where: { id } }), true);
  });
}
