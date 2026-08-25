import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { getIncidentGeoLockCellNeighborhood } from "@/lib/incident-geo-lock";

export type PrismaTransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

const connectionString =
  process.env.DATABASE_URL ?? process.env.DIRECT_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL or DIRECT_URL must be set.");
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export function isPrismaUniqueConstraintError(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002",
  );
}

export async function lockFloodReportForUpdate(
  tx: PrismaTransactionClient,
  reportId: string,
) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "FloodReport"
    WHERE "id" = ${reportId}
    FOR UPDATE
  `;

  return rows.length > 0;
}

export async function lockIncidentForUpdate(
  tx: PrismaTransactionClient,
  incidentId: string,
) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "Incident"
    WHERE "id" = ${incidentId}
    FOR UPDATE
  `;

  return rows.length > 0;
}

/**
 * Serializes concurrent report submissions whose 3x3 grid-cell neighborhoods
 * overlap, so the "does an incident already exist nearby?" read-then-write
 * in the report-create transaction can't race. Locks are transaction-scoped
 * (auto-released on commit/rollback) and always acquired in the same
 * globally-sorted order, which rules out lock-ordering deadlocks.
 */
export async function acquireIncidentGeoLocks(
  tx: PrismaTransactionClient,
  latitude: number,
  longitude: number,
) {
  const cells = getIncidentGeoLockCellNeighborhood(latitude, longitude);

  for (const cell of cells) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${cell.cellX}, ${cell.cellY})`;
  }
}
