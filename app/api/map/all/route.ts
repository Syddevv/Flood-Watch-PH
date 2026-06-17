import { errorResponse } from "@/lib/api-response";
import { parseReportFilters } from "@/lib/api-utils";
import { EVACUATION_CENTERS } from "@/lib/constants";
import {
  getLifecyclePersistencePatch,
  isVisiblePublicLifecycleStatus,
  matchesLifecycleFilter,
  type ReportLifecycleStatus,
} from "@/lib/report-lifecycle";
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
    case "Needs More Confirmation":
      return 0;
    case "Confirmed by Community":
      return 1;
    case "Likely Receded":
      return 2;
    case "Resolved":
      return 3;
    case "Archived":
      return 4;
    default:
      return 5;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsedFilters = parseReportFilters(searchParams);

    if (parsedFilters.error) {
      return errorResponse(parsedFilters.error, 400);
    }

    const includeArchived = searchParams.get("includeArchived") === "true";
    const reports = await prisma.floodReport.findMany({
      where: {
        ...(parsedFilters.filters.severity
          ? { severity: parsedFilters.filters.severity }
          : {}),
        ...(parsedFilters.filters.category
          ? { category: parsedFilters.filters.category }
          : {}),
      },
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
        lastActivityAt: true,
        resolvedAt: true,
        archivedAt: true,
      },
    });

    const reconciledReports = await Promise.all(
      reports.map(async (report) => {
        const patch = getLifecyclePersistencePatch(report);
        if (Object.keys(patch).length === 0) {
          return report;
        }

        return prisma.floodReport.update({
          where: { id: report.id },
          data: patch,
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
            lastActivityAt: true,
            resolvedAt: true,
            archivedAt: true,
          },
        });
      }),
    );

    const filteredReports = reconciledReports
      .filter((report) => {
        const lifecycleStatus = report.status as ReportLifecycleStatus;

        if (!includeArchived && !isVisiblePublicLifecycleStatus(lifecycleStatus)) {
          return false;
        }

        return matchesLifecycleFilter(lifecycleStatus, parsedFilters.filters.status);
      })
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

    const mappedEvacuationCenters = EVACUATION_CENTERS.map((center) => ({
      ...center,
      type: "evacuation_center" as const,
      updatedAt: center.lastVerifiedAt,
    }));

    const lastUpdatedCandidates = [
      ...filteredReports.map((report) => report.updatedAt.getTime()),
      ...mappedEvacuationCenters
        .map((center) => center.updatedAt)
        .filter((updatedAt): updatedAt is string => Boolean(updatedAt))
        .map((updatedAt) => new Date(updatedAt).getTime()),
    ];

    return Response.json({
      reports: filteredReports,
      evacuationCenters: mappedEvacuationCenters,
      meta: {
        reportCount: filteredReports.length,
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
