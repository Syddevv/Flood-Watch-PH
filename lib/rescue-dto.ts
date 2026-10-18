import type { RescueRequest, RescueRequestEvent } from "@prisma/client";

type RecordWithEvents = RescueRequest & { events?: RescueRequestEvent[] };

export function toRescueDto(record: RecordWithEvents, admin = false) {
  return {
    id: record.id, reference: record.reference, status: record.status, priority: record.priority,
    version: record.version, createdAt: record.createdAt, updatedAt: record.updatedAt,
    forWhom: record.forWhom, assistedPersonName: record.assistedPersonName, relationship: record.relationship,
    primaryContact: record.primaryContact, alternateContact: record.alternateContact,
    peopleCount: record.peopleCount, vulnerabilityTags: record.vulnerabilityTags,
    vulnerabilityNotes: record.vulnerabilityNotes, description: record.description,
    locationName: record.locationName, latitude: record.latitude, longitude: record.longitude,
    locationUncertainty: record.locationUncertainty, localityCode: record.localityCode, barangay: record.barangay,
    linkedReportId: record.linkedReportId,
    linkedReportConsentConfirmedAt: admin ? record.linkedReportConsentConfirmedAt : undefined,
    caseOwnerUserId: admin ? record.caseOwnerUserId : undefined,
    confirmedTeamReference: record.confirmedTeamReference,
    outcome: record.outcome,
    requesterUserId: admin ? record.requesterUserId : undefined,
    creatorUserId: admin ? record.creatorUserId : undefined,
    intakeChannel: admin ? record.intakeChannel : undefined,
    events: record.events?.filter((event) => admin || event.visibility === "public").map((event) => ({
      id: event.id, eventType: event.eventType, previousStatus: event.previousStatus,
      nextStatus: event.nextStatus, previousPriority: event.previousPriority,
      nextPriority: event.nextPriority, createdAt: event.createdAt,
      reason: admin ? event.reason : null,
      note: admin ? event.note : event.eventType === "received" ? event.note : null,
      ...(admin ? { actorUserId: event.actorUserId, visibility: event.visibility,
        previousCaseOwnerUserId: event.previousCaseOwnerUserId,
        nextCaseOwnerUserId: event.nextCaseOwnerUserId } : {}),
    })),
  };
}
