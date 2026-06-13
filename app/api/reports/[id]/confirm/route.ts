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
        confirmationCount: true,
        resolvedCount: true,
        resolvedAt: true,
      },
    });

    if (!report) {
      return errorResponse("Flood report not found.", 404);
    }

    if (report.status === "Resolved" || report.resolvedAt) {
      return errorResponse("Resolved reports can no longer be confirmed.", 400);
    }

    const updatedReport = await prisma.$transaction(async (tx) => {
      await tx.reportConfirmation.create({
        data: {
          reportId: id,
          confirmationType: "confirmed",
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
    console.error("Failed to confirm report.", error);
    return errorResponse("Something went wrong while confirming the report.");
  }
}
