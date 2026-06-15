import { errorResponse, successResponse } from "@/lib/api-response";
import {
  deriveReportLifecycleStatus,
  getLifecyclePersistencePatch,
} from "@/lib/report-lifecycle";
import { prisma } from "@/lib/prisma";
import {
  getReportSessionHashFromRequest,
  REPORT_ACTION_UNDO_WINDOW_MS,
} from "@/lib/report-session";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const sessionHash = getReportSessionHashFromRequest(request);

    if (!sessionHash) {
      return errorResponse("Missing session information for this action.", 400);
    }

    const report = await prisma.floodReport.findUnique({
      where: { id },
      select: {
        id: true,
        severity: true,
        status: true,
        confirmationCount: true,
        resolvedCount: true,
        createdAt: true,
        updatedAt: true,
        lastActivityAt: true,
        resolvedAt: true,
        archivedAt: true,
      },
    });

    if (!report) {
      return errorResponse("Flood report not found.", 404);
    }

    const currentLifecycleStatus = deriveReportLifecycleStatus(report);
    if (currentLifecycleStatus === "Archived" || currentLifecycleStatus === "Resolved") {
      return errorResponse("This report is no longer active.", 400);
    }

    const updatedReport = await prisma.$transaction(async (tx) => {
      const lifecyclePatch = getLifecyclePersistencePatch(report);
      if (Object.keys(lifecyclePatch).length > 0) {
        await tx.floodReport.update({
          where: { id },
          data: lifecyclePatch,
        });
      }

      const existingResolution = await tx.reportConfirmation.findFirst({
        where: {
          reportId: id,
          confirmationType: "resolved",
          ipHash: sessionHash,
        },
      });

      if (existingResolution) {
        throw new Error("DUPLICATE_RESOLVED_ACTION");
      }

      await tx.reportConfirmation.create({
        data: {
          reportId: id,
          confirmationType: "resolved",
          ipHash: sessionHash,
        },
      });

      const nextResolvedCount = report.resolvedCount + 1;

      const nextReport = await tx.floodReport.update({
        where: { id },
        data: {
          resolvedCount: {
            increment: 1,
          },
          lastActivityAt: new Date(),
          ...(nextResolvedCount >= 3 && !report.resolvedAt
            ? {
                resolvedAt: new Date(),
              }
            : {}),
        },
      });

      const nextPatch = getLifecyclePersistencePatch(nextReport);
      if (Object.keys(nextPatch).length === 0) {
        return nextReport;
      }

      return tx.floodReport.update({
        where: { id },
        data: nextPatch,
      });
    });

    return successResponse(updatedReport);
  } catch (error) {
    if (error instanceof Error && error.message === "DUPLICATE_RESOLVED_ACTION") {
      return errorResponse("This report has already been updated from this browser.", 409);
    }

    console.error("Failed to submit water receded report.", error);
    return errorResponse("Something went wrong while updating the report.");
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const sessionHash = getReportSessionHashFromRequest(request);

    if (!sessionHash) {
      return errorResponse("Missing session information for this action.", 400);
    }

    const report = await prisma.floodReport.findUnique({
      where: { id },
      select: {
        id: true,
        severity: true,
        status: true,
        confirmationCount: true,
        resolvedCount: true,
        createdAt: true,
        updatedAt: true,
        lastActivityAt: true,
        resolvedAt: true,
        archivedAt: true,
      },
    });

    if (!report) {
      return errorResponse("Flood report not found.", 404);
    }

    const currentLifecycleStatus = deriveReportLifecycleStatus(report);
    if (currentLifecycleStatus === "Archived") {
      return errorResponse("This report can no longer be updated.", 400);
    }

    const matchingResolution = await prisma.reportConfirmation.findFirst({
      where: {
        reportId: id,
        confirmationType: "resolved",
        ipHash: sessionHash,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!matchingResolution) {
      return errorResponse("Unable to undo this action.", 400);
    }

    if (Date.now() - matchingResolution.createdAt.getTime() > REPORT_ACTION_UNDO_WINDOW_MS) {
      return errorResponse("Undo window has expired.", 400);
    }

    const updatedReport = await prisma.$transaction(async (tx) => {
      await tx.reportConfirmation.delete({
        where: {
          id: matchingResolution.id,
        },
      });

      const remainingActivity = await tx.reportConfirmation.aggregate({
        where: {
          reportId: id,
        },
        _max: {
          createdAt: true,
        },
      });

      const lastActivityAt =
        remainingActivity._max.createdAt ?? report.updatedAt ?? report.createdAt;
      const nextResolvedCount = Math.max(report.resolvedCount - 1, 0);

      const nextReport = await tx.floodReport.update({
        where: { id },
        data: {
          resolvedCount: nextResolvedCount,
          lastActivityAt,
          ...(nextResolvedCount < 3 ? { resolvedAt: null } : {}),
        },
      });

      const nextPatch = getLifecyclePersistencePatch(nextReport);
      if (Object.keys(nextPatch).length === 0) {
        return nextReport;
      }

      return tx.floodReport.update({
        where: { id },
        data: nextPatch,
      });
    });

    return successResponse(updatedReport);
  } catch (error) {
    console.error("Failed to undo water receded report.", error);
    return errorResponse("Something went wrong while undoing the water receded report.");
  }
}
