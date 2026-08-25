import { errorResponse, successResponse } from "@/lib/api-response";
import { syncIncidentAggregate } from "@/lib/incident-sync";
import {
  deriveReportLifecycleStatus,
  getLifecyclePersistencePatch,
} from "@/lib/report-lifecycle";
import {
  isPrismaUniqueConstraintError,
  lockFloodReportForUpdate,
  prisma,
  type PrismaTransactionClient,
} from "@/lib/prisma";
import {
  getReportSessionHashFromRequest,
  REPORT_ACTION_UNDO_WINDOW_MS,
} from "@/lib/report-session";
import { protectApiRequest } from "@/lib/request-security";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const protectionResponse = await protectApiRequest(request, {
      scope: "report-resolve",
      limit: 30,
      windowMs: 60 * 60 * 1000,
      requireTrustedOrigin: true,
    });

    if (protectionResponse) {
      return protectionResponse;
    }

    const { id } = await context.params;
    const sessionHash = getReportSessionHashFromRequest(request);

    if (!sessionHash) {
      return errorResponse("A valid report session is required for this action.", 401);
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
        incidentId: true,
      },
    });

    if (!report) {
      return errorResponse("Flood report not found.", 404);
    }

    const currentLifecycleStatus = deriveReportLifecycleStatus(report);
    if (currentLifecycleStatus === "Archived" || currentLifecycleStatus === "Resolved") {
      return errorResponse("This report is no longer active.", 400);
    }

    const updatedReport = await prisma.$transaction(async (tx: PrismaTransactionClient) => {
      const lifecyclePatch = getLifecyclePersistencePatch(report);
      if (Object.keys(lifecyclePatch).length > 0) {
        await tx.floodReport.update({
          where: { id },
          data: lifecyclePatch,
        });
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
      const finalReport =
        Object.keys(nextPatch).length === 0
          ? nextReport
          : await tx.floodReport.update({
              where: { id },
              data: nextPatch,
            });

      await syncIncidentAggregate(tx, report.incidentId);

      return finalReport;
    });

    return successResponse(updatedReport);
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      return errorResponse("This report has already been updated from this browser.", 409);
    }

    console.error("Failed to submit water receded report.", error);
    return errorResponse("Something went wrong while updating the report.");
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const protectionResponse = await protectApiRequest(request, {
      scope: "report-resolve-undo",
      limit: 30,
      windowMs: 60 * 60 * 1000,
      requireTrustedOrigin: true,
    });

    if (protectionResponse) {
      return protectionResponse;
    }

    const { id } = await context.params;
    const sessionHash = getReportSessionHashFromRequest(request);

    if (!sessionHash) {
      return errorResponse("A valid report session is required for this action.", 401);
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
        incidentId: true,
      },
    });

    if (!report) {
      return errorResponse("Flood report not found.", 404);
    }

    const currentLifecycleStatus = deriveReportLifecycleStatus(report);
    if (currentLifecycleStatus === "Archived") {
      return errorResponse("This report can no longer be updated.", 400);
    }

    const updatedReport = await prisma.$transaction(async (tx: PrismaTransactionClient) => {
      await lockFloodReportForUpdate(tx, id);

      const matchingResolution = await tx.reportConfirmation.findFirst({
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
        return null;
      }

      if (
        Date.now() - matchingResolution.createdAt.getTime() >
        REPORT_ACTION_UNDO_WINDOW_MS
      ) {
        return "expired" as const;
      }

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
      const resolvedCount = await tx.reportConfirmation.count({
        where: {
          reportId: id,
          confirmationType: "resolved",
        },
      });

      const lastActivityAt =
        remainingActivity._max.createdAt ?? report.updatedAt ?? report.createdAt;

      const nextReport = await tx.floodReport.update({
        where: { id },
        data: {
          resolvedCount,
          lastActivityAt,
          ...(resolvedCount < 3 ? { resolvedAt: null } : {}),
        },
      });

      const nextPatch = getLifecyclePersistencePatch(nextReport);
      const finalReport =
        Object.keys(nextPatch).length === 0
          ? nextReport
          : await tx.floodReport.update({
              where: { id },
              data: nextPatch,
            });

      await syncIncidentAggregate(tx, report.incidentId);

      return finalReport;
    });

    if (!updatedReport) {
      return errorResponse("Unable to undo this action.", 400);
    }

    if (updatedReport === "expired") {
      return errorResponse("Undo window has expired.", 400);
    }

    return successResponse(updatedReport);
  } catch (error) {
    console.error("Failed to undo water receded report.", error);
    return errorResponse("Something went wrong while undoing the water receded report.");
  }
}
