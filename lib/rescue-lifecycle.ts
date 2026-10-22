import "server-only";

import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canTransitionRescue, EXCEPTIONAL_RESCUE_STATUSES, parseRescueLifecycleAction, RescueError, TERMINAL_RESCUE_STATUSES } from "@/lib/rescue-contracts";
import { toRescueDto } from "@/lib/rescue-dto";

const exceptional: readonly string[] = EXCEPTIONAL_RESCUE_STATUSES;
const legacyOpen = ["triaged", "assigned", "en_route", "on_scene"];
const stale = () => new RescueError("This request changed. Refresh before trying again.", 409);

export async function advanceRescueLifecycle(id: string, actorId: string, raw: unknown) {
  const input = parseRescueLifecycleAction(raw);
  const actionHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const replay = async () => {
    const event = await prisma.rescueRequestEvent.findUnique({ where: { requestId_actionKey: { requestId: id, actionKey: input.actionKey } }, select: { actionHash: true } });
    if (!event) return null;
    if (event.actionHash !== actionHash) throw new RescueError("This action key was used for another decision.", 409);
    return toRescueDto(await prisma.rescueRequest.findUniqueOrThrow({ where: { id } }), true);
  };
  try {
    return await prisma.$transaction(async (tx) => {
      const actor = await tx.user.findUnique({ where: { id: actorId }, select: { role: true } });
      if (actor?.role !== "admin") throw new RescueError("Administrator access required.", 403);
      const record = await tx.rescueRequest.findUnique({ where: { id } });
      if (!record) throw new RescueError("Rescue request not found.", 404);
      const existing = await tx.rescueRequestEvent.findUnique({ where: { requestId_actionKey: { requestId: id, actionKey: input.actionKey } }, select: { actionHash: true } });
      if (existing) {
        if (existing.actionHash !== actionHash) throw new RescueError("This action key was used for another decision.", 409);
        return toRescueDto(record, true);
      }
      if (record.version !== input.expectedVersion) throw stale();
      if (TERMINAL_RESCUE_STATUSES.includes(record.status)) throw new RescueError("Terminal requests cannot be changed.", 400);
      const reconciling = record.workflowVersion === 1 && legacyOpen.includes(record.status) && input.nextStatus === "under_review";
      const legacyException = record.workflowVersion === 1 && legacyOpen.includes(record.status) && exceptional.includes(input.nextStatus) && canTransitionRescue(record.status, input.nextStatus);
      if (!reconciling && !legacyException && !canTransitionRescue(record.status, input.nextStatus)) throw new RescueError("That lifecycle transition is not allowed.", 400);
      if (record.workflowVersion === 1 && legacyOpen.includes(record.status) && !reconciling && !legacyException) throw new RescueError("Reconcile this legacy request before recording new lifecycle facts.", 400);
      if (input.nextStatus === "awaiting_responder" && record.status !== "under_review") throw new RescueError("Use reassignment to return to responder selection.", 400);
      if ((input.dispatchMethod && input.nextStatus !== "dispatched") ||
          (input.occurredAt && !["en_route", "on_scene", "resolved"].includes(input.nextStatus)) ||
          (input.outcomeCode && input.nextStatus !== "resolved") ||
          (input.outcome && input.nextStatus !== "resolved") ||
          (input.caseOwnerUserId && input.nextStatus !== "awaiting_responder") ||
          (input.duplicateRequestId && input.nextStatus !== "duplicate") ||
          (input.referralDestination && input.nextStatus !== "referred") ||
          (input.note && input.nextStatus !== "awaiting_responder")) throw new RescueError("Lifecycle evidence does not match the requested status.", 400);

      const now = new Date();
      const occurredAt = input.occurredAt ?? now;
      if (occurredAt > now) throw new RescueError("A reported occurrence time cannot be in the future.", 400);
      const reasonRequired = reconciling || exceptional.includes(input.nextStatus) || input.nextStatus === "closed";
      if (reasonRequired && (!input.reason || input.reason.length < 10)) throw new RescueError("Record a reason of at least 10 characters.", 400);
      if (input.nextStatus === "awaiting_responder") {
        if (!input.note || input.note.length < 10) throw new RescueError("Record the triage needs and notes.", 400);
        if (!record.caseOwnerUserId && !input.caseOwnerUserId && (!input.reason || input.reason.length < 10)) throw new RescueError("Assign a case owner or document why this case remains unassigned.", 400);
      }
      if (input.caseOwnerUserId) {
        const owner = await tx.user.findUnique({ where: { id: input.caseOwnerUserId }, select: { role: true } });
        if (owner?.role !== "admin") throw new RescueError("Case owner must be an administrator.", 400);
      }
      if (input.nextStatus === "duplicate") {
        if (!input.duplicateRequestId || input.duplicateRequestId === id) throw new RescueError("Link a different existing rescue request.", 400);
        const target = await tx.rescueRequest.findUnique({ where: { id: input.duplicateRequestId }, select: { status: true } });
        if (!target || target.status === "duplicate") throw new RescueError("Choose an existing non-duplicate request.", 400);
      }
      if (input.nextStatus === "referred" && (!input.referralDestination || input.referralDestination.length < 3)) throw new RescueError("Record the referral destination.", 400);
      if (input.nextStatus === "unable_to_contact" && !await tx.rescueRequestEvent.findFirst({ where: { requestId: id, eventType: "contact_attempt_recorded" }, select: { id: true } })) throw new RescueError("Record a contact attempt before closing as unable to contact.", 400);

      const assignment = await tx.rescueAssignment.findFirst({ where: { requestId: id, endedAt: null }, orderBy: { selectedAt: "desc" } });
      const assignmentData: Prisma.RescueAssignmentUpdateInput = {};
      if (input.nextStatus === "responder_confirmed" && (assignment?.status !== "accepted" || assignment.acknowledgementOutcome !== "accepted" || !assignment.acknowledgedAt || !assignment.contactedAt)) throw new RescueError("An admin-recorded acceptance and contact attempt are required.", 400);
      if (input.nextStatus === "dispatched") {
        if (assignment?.status !== "accepted" || !assignment.acknowledgedAt || assignment.dispatchConfirmedAt) throw new RescueError("An accepted, not yet dispatched assignment is required.", 400);
        if (!input.dispatchMethod) throw new RescueError("Record the dispatch confirmation method.", 400);
        assignmentData.status = "dispatched";
        assignmentData.dispatchConfirmedAt = now;
        assignmentData.dispatchConfirmedByAdmin = { connect: { id: actorId } };
        assignmentData.dispatchMethod = input.dispatchMethod;
      }
      if (input.nextStatus === "en_route") {
        if (assignment?.status !== "dispatched" || !assignment.dispatchConfirmedAt) throw new RescueError("Confirm dispatch before recording departure.", 400);
        if (occurredAt < assignment.dispatchConfirmedAt) throw new RescueError("Departure cannot precede dispatch confirmation.", 400);
        assignmentData.status = "en_route";
        assignmentData.departedAt = occurredAt;
      }
      if (input.nextStatus === "on_scene") {
        if (assignment?.status !== "en_route" || !assignment.departedAt) throw new RescueError("Record departure before arrival.", 400);
        if (occurredAt < assignment.departedAt) throw new RescueError("Arrival cannot precede departure.", 400);
        assignmentData.status = "on_scene";
        assignmentData.arrivedAt = occurredAt;
      }
      if (input.nextStatus === "resolved") {
        if (assignment?.status !== "on_scene" || !assignment.arrivedAt) throw new RescueError("Record arrival before resolution.", 400);
        if (!input.outcomeCode || !input.outcome || input.outcome.length < 10 || !input.occurredAt) throw new RescueError("Record an outcome code, resolution description and reported completion time.", 400);
        if (occurredAt < assignment.arrivedAt) throw new RescueError("Completion cannot precede arrival.", 400);
        assignmentData.status = "resolved";
        assignmentData.reportedCompletedAt = occurredAt;
        assignmentData.resolutionDetails = input.outcome;
      }
      if (input.nextStatus === "closed" || exceptional.includes(input.nextStatus)) {
        if (assignment) {
          assignmentData.status = "ended";
          assignmentData.endedAt = now;
          assignmentData.endReason = input.reason;
        }
      }
      const requestData: Prisma.RescueRequestUncheckedUpdateManyInput = { status: input.nextStatus, workflowVersion: 2, version: { increment: 1 } };
      if (input.caseOwnerUserId) requestData.caseOwnerUserId = input.caseOwnerUserId;
      if (input.nextStatus === "resolved") requestData.outcome = input.outcome;
      const updated = await tx.rescueRequest.updateMany({ where: { id, version: input.expectedVersion }, data: requestData });
      if (updated.count !== 1) throw stale();
      if (assignment && Object.keys(assignmentData).length) await tx.rescueAssignment.update({ where: { id: assignment.id }, data: assignmentData });
      await tx.rescueRequestEvent.create({ data: {
        requestId: id, assignmentId: assignment?.id, actorUserId: actorId, source: "admin", eventType: reconciling ? "legacy_reconciled" : "lifecycle_transition",
        previousStatus: record.status, nextStatus: input.nextStatus, previousPriority: record.priority, nextPriority: record.priority,
        previousCaseOwnerUserId: record.caseOwnerUserId, nextCaseOwnerUserId: input.caseOwnerUserId ?? record.caseOwnerUserId,
        visibility: "public", reason: input.reason, occurredAt: input.occurredAt, actionKey: input.actionKey, actionHash,
        details: { adminRecorded: true, ...(input.note ? { triageNote: input.note } : {}), ...(input.dispatchMethod ? { dispatchMethod: input.dispatchMethod } : {}),
          ...(input.outcomeCode ? { outcomeCode: input.outcomeCode } : {}), ...(input.duplicateRequestId ? { duplicateRequestId: input.duplicateRequestId } : {}),
          ...(input.referralDestination ? { referralDestination: input.referralDestination } : {}) },
      } });
      if (["awaiting_responder", "unable_to_contact", "referred", "cancelled"].includes(input.nextStatus)) {
        const admins = await tx.user.findMany({ where: { role: "admin" }, select: { id: true } });
        await tx.adminNotification.createMany({ data: admins.map((admin) => ({
          type: "rescue_lifecycle", title: "Rescue request status updated", detail: `${record.reference} · ${input.nextStatus.replaceAll("_", " ")}`,
          targetType: "RescueRequest", targetId: id, priority: record.priority === "critical" ? "urgent" : "normal",
          recipientUserId: admin.id, dedupeKey: `rescue-lifecycle:${id}:${input.expectedVersion + 1}`,
        })), skipDuplicates: true });
      }
      return toRescueDto(await tx.rescueRequest.findUniqueOrThrow({ where: { id } }), true);
    });
  } catch (error) {
    if (error instanceof RescueError && error.status === 403) throw error;
    const previous = await replay();
    if (previous) return previous;
    if (typeof error === "object" && error !== null && "code" in error && ["P2002", "P2034"].includes(String(error.code))) throw stale();
    throw error;
  }
}
