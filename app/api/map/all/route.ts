import { Prisma } from "@prisma/client";

import { errorResponse } from "@/lib/api-response";
import { parseReportFilters } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

function getSeverityRank(severity: string) {
  switch (severity) {
    case "Critical":
      return 0;
    case "High":
      return 1;
    case "Moderate":
      return 2;
    case "Low":
      return 3;
    default:
      return 4;
  }
}

function getStatusRank(status: string) {
  switch (status) {
    case "Active":
      return 0;
    case "Monitoring":
      return 1;
    case "Resolved":
      return 2;
    default:
      return 3;
  }
}

function buildMapReportWhereClause(filters: {
  status?: string;
  severity?: string;
  category?: string;
}): Prisma.FloodReportWhereInput {
  return {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.severity ? { severity: filters.severity } : {}),
    ...(filters.category ? { category: filters.category } : {}),
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsedFilters = parseReportFilters(searchParams);

    if (parsedFilters.error) {
      return errorResponse(parsedFilters.error, 400);
    }

    const where = buildMapReportWhereClause({
      status: parsedFilters.filters.status,
      severity: parsedFilters.filters.severity,
      category: parsedFilters.filters.category,
    });

    const [reports, evacuationCenters] = await Promise.all([
      prisma.floodReport.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          severity: true,
          status: true,
          locationName: true,
          latitude: true,
          longitude: true,
          confirmationCount: true,
          resolvedCount: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.evacuationCenter.findMany({
        select: {
          id: true,
          name: true,
          address: true,
          city: true,
          province: true,
          latitude: true,
          longitude: true,
          contactNumber: true,
          facilities: true,
          status: true,
          updatedAt: true,
        },
      }),
    ]);

    const mappedReports = reports
      .map((report) => ({
        ...report,
        type: "flood_report" as const,
      }))
      .sort((a, b) => {
        const statusRankDifference = getStatusRank(a.status) - getStatusRank(b.status);
        if (statusRankDifference !== 0) {
          return statusRankDifference;
        }

        const severityRankDifference =
          getSeverityRank(a.severity) - getSeverityRank(b.severity);
        if (severityRankDifference !== 0) {
          return severityRankDifference;
        }

        return b.createdAt.getTime() - a.createdAt.getTime();
      });

    const mappedEvacuationCenters = evacuationCenters.map((center) => ({
      ...center,
      type: "evacuation_center" as const,
    }));

    const lastUpdatedCandidates = [
      ...mappedReports.map((report) => report.updatedAt.getTime()),
      ...mappedEvacuationCenters.map((center) => center.updatedAt.getTime()),
    ];

    return Response.json({
      reports: mappedReports,
      evacuationCenters: mappedEvacuationCenters,
      meta: {
        reportCount: mappedReports.length,
        evacuationCenterCount: mappedEvacuationCenters.length,
        lastUpdated:
          lastUpdatedCandidates.length > 0
            ? new Date(Math.max(...lastUpdatedCandidates)).toISOString()
            : new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to fetch map data.", error);
    return errorResponse("Something went wrong while fetching map data.");
  }
}
