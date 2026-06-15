import { errorResponse, successResponse } from "@/lib/api-response";
import {
  getLifecyclePersistencePatch,
  type ReportLifecycleStatus,
} from "@/lib/report-lifecycle";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const includeArchived = new URL(request.url).searchParams.get("includeArchived") === "true";

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

    const patch = getLifecyclePersistencePatch(report);
    const reconciledReport =
      Object.keys(patch).length > 0
        ? await prisma.floodReport.update({
            where: { id },
            data: patch,
            include: {
              updates: {
                orderBy: {
                  createdAt: "desc",
                },
              },
            },
          })
        : report;

    if (
      !includeArchived &&
      (reconciledReport.status as ReportLifecycleStatus) === "Archived"
    ) {
      return errorResponse("Flood report not found.", 404);
    }

    return successResponse(reconciledReport);
  } catch (error) {
    console.error("Failed to fetch report.", error);
    return errorResponse("Something went wrong while fetching the report.");
  }
}
