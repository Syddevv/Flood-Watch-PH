import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function recordAdminAudit(input: { actorUserId?: string; action: string; targetType?: string; targetId?: string; requestId?: string; metadata?: Record<string, unknown> }) {
  return prisma.adminAuditLog.create({ data: { actorUserId: input.actorUserId, action: input.action, targetType: input.targetType, targetId: input.targetId, requestId: input.requestId, metadata: input.metadata as Prisma.InputJsonValue | undefined } });
}
