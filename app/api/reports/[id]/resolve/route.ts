import { errorResponse, successResponse } from "@/lib/api-response";
import {
  deriveReportLifecycleStatus,
  getLifecyclePersistencePatch,
} from "@/lib/report-lifecycle";
import { prisma } from "@/lib/prisma";
import { getReportSessionHashFromRequest } from "@/lib/report-session";

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
