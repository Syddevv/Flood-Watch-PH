import { errorResponse, successResponse } from "@/lib/api-response";
import {
  getLifecyclePersistencePatch,
  type ReportLifecycleStatus,
} from "@/lib/report-lifecycle";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

const reportDetailInclude = {
  updates: {
    orderBy: {
      createdAt: "desc" as const,
    },
  },
  confirmations: {
    select: {
      confirmationType: true,
      createdAt: true,
    },
  },
} as const;

type DetailedReportRecord = {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  status: string;
  locationName: string;
  latitude: number;
  longitude: number;
  imageUrl: string | null;
  reportedByName: string | null;
  sourceType: string;
  confirmationCount: number;
  resolvedCount: number;
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt: Date;
  resolvedAt: Date | null;
  archivedAt: Date | null;
  updates: Array<{
    id: string;
    message: string;
    updateType: string;
    createdAt: Date;
  }>;
  confirmations: Array<{
    confirmationType: string;
    createdAt: Date;
  }>;
};

function serializeDetailedReport(
  report: DetailedReportRecord,
) {
  const lastConfirmedAt =
    report.confirmations
      .filter((entry) => entry.confirmationType === "confirmed")
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0]
      ?.createdAt ?? null;
  const lastResolvedConfirmationAt =
    report.confirmations
      .filter((entry) => entry.confirmationType === "resolved")
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0]
      ?.createdAt ?? null;

  return {
    ...report,
    lastConfirmedAt: lastConfirmedAt?.toISOString() ?? null,
    lastResolvedConfirmationAt: lastResolvedConfirmationAt?.toISOString() ?? null,
    confirmations: undefined,
  };
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const includeArchived = new URL(request.url).searchParams.get("includeArchived") === "true";

    const report = await prisma.floodReport.findUnique({
      where: { id },
      include: reportDetailInclude,
    });

    if (!report) {
      return errorResponse("Flood report not found.", 404);
    }

    const patch = getLifecyclePersistencePatch(report);
    const reconciledReport =
      Object.keys(patch).length > 0
        ? await prisma.floodReport.update({
            where: { id },
            data: patch,
            include: reportDetailInclude,
          })
        : report;

    if (
      !includeArchived &&
      (reconciledReport.status as ReportLifecycleStatus) === "Archived"
    ) {
      return errorResponse("Flood report not found.", 404);
    }

    return successResponse(serializeDetailedReport(reconciledReport));
  } catch (error) {
    console.error("Failed to fetch report.", error);
    return errorResponse("Something went wrong while fetching the report.");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    const existingReport = await prisma.floodReport.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingReport) {
      return errorResponse("Flood report not found.", 404);
    }

    const deletedReport = await prisma.floodReport.delete({
      where: { id },
    });

    return successResponse(deletedReport);
  } catch (error) {
    console.error("Failed to delete report.", error);
    return errorResponse("Something went wrong while deleting the report.");
  }
}
