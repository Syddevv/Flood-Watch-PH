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
        confirmationCount: true,
        resolvedCount: true,
        resolvedAt: true,
      },
    });

    if (!report) {
      return errorResponse("Flood report not found.", 404);
    }

    if (report.status === "Resolved" || report.resolvedAt) {
      return errorResponse("Flood reports already marked as resolved can no longer be confirmed.", 400);
    }

    const updatedReport = await prisma.$transaction(async (tx) => {
      const existingConfirmation = await tx.reportConfirmation.findFirst({
        where: {
          reportId: id,
          confirmationType: "confirmed",
          ipHash: sessionHash,
        },
      });

      if (existingConfirmation) {
        throw new Error("DUPLICATE_CONFIRMED_ACTION");
      }

      await tx.reportConfirmation.create({
        data: {
          reportId: id,
          confirmationType: "confirmed",
          ipHash: sessionHash,
        },
      });

      return tx.floodReport.update({
        where: { id },
        data: {
          confirmationCount: {
            increment: 1,
          },
        },
      });
    });

    return successResponse(updatedReport);
  } catch (error) {
    if (error instanceof Error && error.message === "DUPLICATE_CONFIRMED_ACTION") {
      return errorResponse("You already confirmed this report from this browser session.", 409);
    }

    console.error("Failed to confirm report.", error);
    return errorResponse("Something went wrong while confirming the report.");
  }
}
