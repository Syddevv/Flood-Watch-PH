import { errorResponse, successResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

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
      await tx.reportConfirmation.create({
        data: {
          reportId: id,
          confirmationType: "resolved",
        },
      });

      return tx.floodReport.update({
        where: { id },
        data: {
          resolvedCount: {
            increment: 1,
          },
          ...(nextResolvedCount >= 3 && report.status !== "Resolved"
            ? {
                status: "Possibly Resolved",
              }
            : {}),
        },
      });
    });

    return successResponse(updatedReport);
  } catch (error) {
    console.error("Failed to mark report as resolved.", error);
    return errorResponse("Something went wrong while updating the report.");
  }
}
