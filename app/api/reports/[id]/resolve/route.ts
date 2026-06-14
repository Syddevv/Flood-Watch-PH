import { errorResponse, successResponse } from "@/lib/api-response";
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
        status: true,
        resolvedCount: true,
        resolvedAt: true,
      },
    });

    if (!report) {
      return errorResponse("Flood report not found.", 404);
    }

    if (report.status === "Resolved" || report.resolvedAt) {
      return errorResponse("This report is already resolved.", 400);
    }

    const nextResolvedCount = report.resolvedCount + 1;

    const updatedReport = await prisma.$transaction(async (tx) => {
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

      return tx.floodReport.update({
        where: { id },
        data: {
          resolvedCount: {
            increment: 1,
          },
          ...(nextResolvedCount >= 3
            ? {
                status: "Resolved",
                resolvedAt: new Date(),
              }
            : nextResolvedCount >= 2
            ? {
                status: "Likely Resolved",
              }
            : {}),
        },
      });
    });

    return successResponse(updatedReport);
  } catch (error) {
    if (error instanceof Error && error.message === "DUPLICATE_RESOLVED_ACTION") {
      return errorResponse(
        "You already marked this report as resolved from this browser session.",
        409,
      );
    }

    console.error("Failed to mark report as resolved.", error);
    return errorResponse("Something went wrong while updating the report.");
  }
}
