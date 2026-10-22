import { errorResponse, successResponse } from "@/lib/api-response";
import { getAuthenticatedUserFromRequest } from "@/lib/auth-session";
import { getAdminSettings } from "@/lib/admin-settings-store";
import { accountConfirmationKey } from "@/lib/report-confirmation-identity";
import { syncIncidentAggregate } from "@/lib/incident-sync";
import {
  deriveReportLifecycleStatus,
  getLifecyclePersistencePatch,
  isEligiblePublicReport,
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
      scope: "report-confirm",
      limit: 30,
      windowMs: 60 * 60 * 1000,
      requireTrustedOrigin: true,
    });

    if (protectionResponse) {
      return protectionResponse;
    }

    const { id } = await context.params;
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) return errorResponse("Please log in to confirm flood reports.", 401);
    const confirmationKey = accountConfirmationKey(user.id);
    const settings = await getAdminSettings();

    const report = await prisma.floodReport.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
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

    if (!report || report.verificationStatus !== "verified") {
      return errorResponse("Flood report not found.", 404);
    }
    if (report.userId === user.id) return errorResponse("You cannot confirm your own report.", 403);
    if (!isEligiblePublicReport(report, new Date(), settings)) return errorResponse("This report is no longer available for confirmation.", 400);

    const currentLifecycleStatus = deriveReportLifecycleStatus(report, new Date(), settings);
    if (currentLifecycleStatus === "Archived") {
      return errorResponse("This report is no longer active.", 400);
    }

    if (currentLifecycleStatus === "Resolved") {
      return errorResponse("This report is no longer active.", 400);
    }

    const updatedReport = await prisma.$transaction(async (tx: PrismaTransactionClient) => {
      await lockFloodReportForUpdate(tx, id);
      const currentReview = await tx.floodReport.findUnique({ where: { id } });
      if (currentReview?.verificationStatus !== "verified") return "rejected" as const;
      if (currentReview.userId === user.id) return "forbidden" as const;
      if (!isEligiblePublicReport(currentReview, new Date(), settings) || deriveReportLifecycleStatus(currentReview, new Date(), settings) === "Resolved") return "unavailable" as const;
      const lifecyclePatch = getLifecyclePersistencePatch(currentReview, new Date(), settings);
      if (Object.keys(lifecyclePatch).length > 0) {
        await tx.floodReport.update({
          where: { id },
          data: lifecyclePatch,
        });
      }

      await tx.reportConfirmation.create({
        data: {
          reportId: id,
          confirmationType: "confirmed",
          ipHash: confirmationKey,
        },
      });

      const nextReport = await tx.floodReport.update({
        where: { id },
        data: {
          confirmationCount: {
            increment: 1,
          },
          lastActivityAt: new Date(),
        },
      });

      const nextPatch = getLifecyclePersistencePatch(nextReport, new Date(), settings);
      if (Object.keys(nextPatch).length > 0) await tx.floodReport.update({ where: { id }, data: nextPatch });

      await syncIncidentAggregate(tx, report.incidentId);

      return tx.floodReport.findUniqueOrThrow({ where: { id }, include: reportListInclude });
    });

    if (updatedReport === "rejected") return errorResponse("Flood report not found.", 404);
    if (updatedReport === "forbidden") return errorResponse("You cannot confirm your own report.", 403);
    if (updatedReport === "unavailable") return errorResponse("This report is no longer available for confirmation.", 400);

    return successResponse(serializeReportRecord(updatedReport as PublicReportRecord, { userId: user.id }));
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      return errorResponse("You have already confirmed this report.", 409);
    }

    console.error("Failed to confirm report.", error);
    return errorResponse("Something went wrong while confirming the report.");
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const protectionResponse = await protectApiRequest(request, {
      scope: "report-confirm-undo",
      limit: 30,
      windowMs: 60 * 60 * 1000,
      requireTrustedOrigin: true,
    });

    if (protectionResponse) {
      return protectionResponse;
    }

    const { id } = await context.params;
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) return errorResponse("Please log in to confirm flood reports.", 401);
    const confirmationKey = accountConfirmationKey(user.id);
    const settings = await getAdminSettings();

    const report = await prisma.floodReport.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
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
    if (report.userId === user.id) return errorResponse("You cannot confirm your own report.", 403);

    const currentLifecycleStatus = deriveReportLifecycleStatus(report, new Date(), settings);
    if (currentLifecycleStatus === "Archived" || currentLifecycleStatus === "Resolved") {
      return errorResponse("This report can no longer be updated.", 400);
    }

    const updatedReport = await prisma.$transaction(async (tx: PrismaTransactionClient) => {
      await lockFloodReportForUpdate(tx, id);

      const matchingConfirmation = await tx.reportConfirmation.findFirst({
        where: {
          reportId: id,
          confirmationType: "confirmed",
          ipHash: confirmationKey,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (!matchingConfirmation) {
        return null;
      }

      if (
        Date.now() - matchingConfirmation.createdAt.getTime() >
        REPORT_ACTION_UNDO_WINDOW_MS
      ) {
        return "expired" as const;
      }

      await tx.reportConfirmation.delete({
        where: {
          id: matchingConfirmation.id,
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
      const confirmationCount = await tx.reportConfirmation.count({
        where: {
          reportId: id,
          confirmationType: "confirmed",
        },
      });

      const lastActivityAt =
        remainingActivity._max.createdAt ?? report.updatedAt ?? report.createdAt;

      const nextReport = await tx.floodReport.update({
        where: { id },
        data: {
          confirmationCount,
          status: "Needs More Confirmation",
          lastActivityAt,
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
    console.error("Failed to undo report confirmation.", error);
    return errorResponse("Something went wrong while undoing the confirmation.");
  }
}
