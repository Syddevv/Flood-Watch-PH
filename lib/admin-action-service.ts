import "server-only";

import type { Prisma, PrismaClient } from "@prisma/client";

type DbClient = PrismaClient | Prisma.TransactionClient;

export async function recordAdminOperationalAction(
  db: DbClient,
  input: {
    targetType: string;
    targetId: string;
    actionType: string;
    actorUserId?: string;
    previousValue?: string | null;
    nextValue?: string | null;
    visibility?: "internal" | "public";
    note?: string | null;
    requestId?: string | null;
  },
) {
  return db.adminOperationalAction.create({
    data: {
      targetType: input.targetType,
      targetId: input.targetId,
      actionType: input.actionType,
      actorUserId: input.actorUserId,
      previousValue: input.previousValue,
      nextValue: input.nextValue,
      visibility: input.visibility ?? "internal",
      note: input.note,
      requestId: input.requestId,
    },
  });
}

export type AdminActionCreateInput = Prisma.AdminOperationalActionCreateInput;
