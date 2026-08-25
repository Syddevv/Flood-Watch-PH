import { deriveIncidentAggregate } from "@/lib/incident-lifecycle";
import { lockIncidentForUpdate, type PrismaTransactionClient } from "@/lib/prisma";

/**
 * Recomputes and persists an incident's rolled-up status from its current
 * constituent reports. Must run inside the same transaction as whatever
 * report-level change triggered it, after that change has been written, so
 * the aggregate reflects the report's new state.
 */
export async function syncIncidentAggregate(
  tx: PrismaTransactionClient,
  incidentId: string,
  now: Date = new Date(),
) {
  await lockIncidentForUpdate(tx, incidentId);

  const siblingReports = await tx.floodReport.findMany({
    where: { incidentId },
    select: {
      status: true,
      severity: true,
      confirmationCount: true,
      resolvedCount: true,
      createdAt: true,
      updatedAt: true,
      lastActivityAt: true,
      resolvedAt: true,
      archivedAt: true,
    },
  });

  const aggregate = deriveIncidentAggregate(siblingReports, now);

  await tx.incident.update({
    where: { id: incidentId },
    data: {
      status: aggregate.status,
      lastActivityAt: now,
    },
  });
}
