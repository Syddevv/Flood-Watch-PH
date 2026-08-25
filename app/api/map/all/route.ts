import { errorResponse } from "@/lib/api-response";
import { parseReportFilters } from "@/lib/api-utils";
import { CALUMPIT_BOUNDS, isWithinCalumpit } from "@/lib/calumpit-boundary";
import {
  EVACUATION_CENTER_NEARBY_RADIUS_KM,
  NEARBY_EVACUATION_CENTERS,
} from "@/lib/evacuation-center-scope";
import {
  deriveReportLifecycleStatus,
  isVisiblePublicLifecycleStatus,
  matchesLifecycleFilter,
  type ReportLifecycleStatus,
} from "@/lib/report-lifecycle";
import { prisma } from "@/lib/prisma";
import { protectApiRequest } from "@/lib/request-security";
import { logApiError } from "@/lib/structured-logger";

const mapReportSelect = {
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
} as const;
const MAX_MAP_REPORTS = 500;

type MapReportRecord = {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  status: string;
  locationName: string;
  latitude: number;
  longitude: number;
  confirmationCount: number;
  resolvedCount: number;
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt: Date;
  resolvedAt: Date | null;
  archivedAt: Date | null;
};

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
    const protectionResponse = await protectApiRequest(request, {
      scope: "map-all",
      limit: 120,
      windowMs: 60 * 1000,
    });

    if (protectionResponse) {
      return protectionResponse;
    }

    const { searchParams } = new URL(request.url);
    const parsedFilters = parseReportFilters(searchParams);

    if (parsedFilters.error) {
      return errorResponse(parsedFilters.error, 400);
    }

    const [[minLatitude, minLongitude], [maxLatitude, maxLongitude]] = CALUMPIT_BOUNDS;
    const reports: MapReportRecord[] = await prisma.floodReport.findMany({
      where: {
        latitude: { gte: minLatitude, lte: maxLatitude },
        longitude: { gte: minLongitude, lte: maxLongitude },
        ...(parsedFilters.filters.severity
          ? { severity: parsedFilters.filters.severity }
          : {}),
        ...(parsedFilters.filters.category
          ? { category: parsedFilters.filters.category }
          : {}),
      },
      select: mapReportSelect,
      orderBy: { createdAt: "desc" },
      take: MAX_MAP_REPORTS,
    });

    const reconciledReports = reports.map((report) => ({
      ...report,
      status: deriveReportLifecycleStatus(report),
    }));

    const filteredReports = reconciledReports
      .filter((report: MapReportRecord) => {
        if (!isWithinCalumpit(report.latitude, report.longitude)) {
          return false;
        }

        const lifecycleStatus = report.status as ReportLifecycleStatus;

        if (!isVisiblePublicLifecycleStatus(lifecycleStatus)) {
          return false;
        }

        return matchesLifecycleFilter(lifecycleStatus, parsedFilters.filters.status);
      })
      .map((report: MapReportRecord) => ({
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

    // Reports (above) are restricted to the Calumpit polygon. Evacuation
    // centers deliberately use a different rule - a radius around Calumpit -
    // so neighbouring-town shelters stay visible. Two distinct rules side by
    // side is the point: reports are restricted to Calumpit, centers are not.
    const mappedEvacuationCenters = NEARBY_EVACUATION_CENTERS.map((center) => ({
      ...center,
      type: "evacuation_center" as const,
      updatedAt: center.lastVerifiedAt,
    }));

    const lastUpdatedCandidates = [
      ...filteredReports.map((report: MapReportRecord) => report.updatedAt.getTime()),
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
        evacuationCenterRadiusKm: EVACUATION_CENTER_NEARBY_RADIUS_KM,
        lastUpdated:
          lastUpdatedCandidates.length > 0
            ? new Date(Math.max(...lastUpdatedCandidates)).toISOString()
            : new Date().toISOString(),
      },
    });
  } catch (error) {
    logApiError("map-data-fetch-failed", request, error);
    return errorResponse("Something went wrong while fetching map data.");
  }
}
