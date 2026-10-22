import { errorResponse, successResponse } from "@/lib/api-response";
import { getAuthenticatedUserFromRequest } from "@/lib/auth-session";
import { getAdminSettings } from "@/lib/admin-settings-store";
import { accountConfirmationKey } from "@/lib/report-confirmation-identity";
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
import { REPORT_ACTION_UNDO_WINDOW_MS } from "@/lib/report-session";
import { protectApiRequest } from "@/lib/request-security";
import { reportListInclude, serializeReportRecord, type PublicReportRecord } from "@/lib/report-api";

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
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) return errorResponse("Please log in to mark flood reports as receded.", 401);
    const settings = await getAdminSettings();
    const confirmationKey = accountConfirmationKey(user.id);

    const report = await prisma.floodReport.findUnique({
      where: { id },
      select: {
        id: true,
        severity: true,
        status: true,
        verificationStatus: true,
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

    if (!report || report.verificationStatus === "rejected") {
      return errorResponse("Flood report not found.", 404);
    }

    const currentLifecycleStatus = deriveReportLifecycleStatus(report, new Date(), settings);
    if (currentLifecycleStatus === "Archived" || currentLifecycleStatus === "Resolved") {
      return errorResponse("This report is no longer active.", 400);
    }

    const updatedReport = await prisma.$transaction(async (tx: PrismaTransactionClient) => {
      await lockFloodReportForUpdate(tx, id);
      const currentReview = await tx.floodReport.findUnique({ where: { id }, select: { verificationStatus: true } });
      if (currentReview?.verificationStatus === "rejected") return "rejected" as const;
      const lifecyclePatch = getLifecyclePersistencePatch(report, new Date(), settings);
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
          ipHash: confirmationKey,
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

      const nextPatch = getLifecyclePersistencePatch(nextReport, new Date(), settings);
      if (Object.keys(nextPatch).length > 0) await tx.floodReport.update({ where: { id }, data: nextPatch });

      await syncIncidentAggregate(tx, report.incidentId);

      return tx.floodReport.findUniqueOrThrow({ where: { id }, include: reportListInclude });
    });

    if (updatedReport === "rejected") return errorResponse("Flood report not found.", 404);

    return successResponse(serializeReportRecord(updatedReport as PublicReportRecord, { userId: user.id }));
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
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) return errorResponse("Please log in to mark flood reports as receded.", 401);
    const settings = await getAdminSettings();
    const confirmationKey = accountConfirmationKey(user.id);

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

    const currentLifecycleStatus = deriveReportLifecycleStatus(report, new Date(), settings);
    if (currentLifecycleStatus === "Archived") {
      return errorResponse("This report can no longer be updated.", 400);
    }

    const updatedReport = await prisma.$transaction(async (tx: PrismaTransactionClient) => {
      await lockFloodReportForUpdate(tx, id);

      const matchingResolution = await tx.reportConfirmation.findFirst({
        where: {
          reportId: id,
          confirmationType: "resolved",
          ipHash: confirmationKey,
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
          status: "Needs More Confirmation",
          lastActivityAt,
          ...(resolvedCount < 3 ? { resolvedAt: null } : {}),
        },
      });

      const nextPatch = getLifecyclePersistencePatch(nextReport, new Date(), settings);
      if (Object.keys(nextPatch).length > 0) await tx.floodReport.update({ where: { id }, data: nextPatch });

      await syncIncidentAggregate(tx, report.incidentId);

      return tx.floodReport.findUniqueOrThrow({ where: { id }, include: reportListInclude });
    });

    if (!updatedReport) {
      return errorResponse("Unable to undo this action.", 400);
    }

    if (updatedReport === "expired") {
      return errorResponse("Undo window has expired.", 400);
    }

    return successResponse(serializeReportRecord(updatedReport as PublicReportRecord, { userId: user.id }));
  } catch (error) {
    console.error("Failed to undo water receded report.", error);
    return errorResponse("Something went wrong while undoing the water receded report.");
  }
}
