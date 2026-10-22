import "server-only";
import { createHash } from "node:crypto";
import { prisma, type PrismaTransactionClient } from "@/lib/prisma";
import { ADMIN_SETTINGS_KEYS, settingsFromRows } from "@/lib/admin-settings-config";

export async function getAdminSettings(db: Pick<typeof prisma, "adminSetting"> = prisma) {
  return (await getAdminSettingsSnapshot(db)).values;
}

export async function getAdminSettingsSnapshot(db: Pick<typeof prisma, "adminSetting"> = prisma) {
  const rows = await db.adminSetting.findMany({ where: { key: { in: ADMIN_SETTINGS_KEYS } }, orderBy: { key: "asc" }, select: { key: true, value: true, updatedAt: true } });
  const version = createHash("sha256").update(JSON.stringify(rows)).digest("hex");
  return { values: settingsFromRows(rows), version };
}

export async function createAdminNotifications(
  tx: PrismaTransactionClient,
  event: { type: string; title: string; detail: string; targetType: string; targetId: string; priority?: string; dedupeKey: string },
) {
  const admins = await tx.user.findMany({ where: { role: "admin" }, select: { id: true } });
  if (!admins.length) return;
  await tx.adminNotification.createMany({
    data: admins.map(({ id }) => ({ ...event, recipientUserId: id })),
    skipDuplicates: true,
  });
}
