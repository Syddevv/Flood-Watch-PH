import "server-only";

import { prisma } from "@/lib/prisma";
import type { ReportVisibilitySettings } from "@/lib/report-lifecycle";

/** Query-time archival keeps history current without depending on a scheduler. */
export async function archiveExpiredReports(settings: ReportVisibilitySettings, now = new Date()) {
  if (!settings.autoArchiveExpiredReports) return;
  await prisma.floodReport.updateMany({
    where: {
      archivedAt: null,
      createdAt: { lte: new Date(now.getTime() - settings.publicReportVisibilityHours * 3_600_000) },
    },
    data: { status: "Archived", archivedAt: now },
  });
}
