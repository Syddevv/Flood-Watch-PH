import { errorResponse, successResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    const report = await prisma.floodReport.findUnique({
      where: { id },
      include: {
        updates: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!report) {
      return errorResponse("Flood report not found.", 404);
    }

    return successResponse(report);
  } catch (error) {
    console.error("Failed to fetch report.", error);
    return errorResponse("Something went wrong while fetching the report.");
  }
}
