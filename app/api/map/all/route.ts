import { errorResponse } from "@/lib/api-response";
import { parseReportFilters } from "@/lib/api-utils";
import { BULACAN_BOUNDS, isWithinBulacan } from "@/lib/bulacan-scope";
import { getPublicEvacuationCenters } from "@/lib/public-evacuation-query";
import { BULACAN_SCOPE_VERSION } from "@/lib/bulacan-scope";
import {
  deriveReportLifecycleStatus,
  isEligiblePublicMapReport,
  matchesLifecycleFilter,
  type ReportLifecycleStatus,
} from "@/lib/report-lifecycle";
import { prisma } from "@/lib/prisma";
import { getAdminSettings } from "@/lib/admin-settings-store";
import { archiveExpiredReports } from "@/lib/report-expiration";
import { protectApiRequest } from "@/lib/request-security";
import { logApiError } from "@/lib/structured-logger";

const mapReportSelect = {
  id: true,
  title: true,
  description: true,
  category: true,
  severity: true,
  status: true,
  verificationStatus: true,
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
  user: { select: { fullName: true } },
} as const;
const MAX_MAP_REPORTS = 500;

type MapReportRecord = {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  status: string;
  verificationStatus: string;
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
  user: { fullName: string | null } | null;
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
    const settings = await getAdminSettings();
    const now = new Date();
    await archiveExpiredReports(settings, now);
    const parsedFilters = parseReportFilters(searchParams);

    if (parsedFilters.error) {
      return errorResponse(parsedFilters.error, 400);
    }

    const [[minLatitude, minLongitude], [maxLatitude, maxLongitude]] = BULACAN_BOUNDS;
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
      status: deriveReportLifecycleStatus(report, now, settings),
    }));

    const filteredReports = reconciledReports
      .filter((report: MapReportRecord) => {
        if (!isWithinBulacan(report.latitude, report.longitude)) {
          return false;
        }

        const lifecycleStatus = report.status as ReportLifecycleStatus;

        if (!isEligiblePublicMapReport(report, now, settings)) {
          return false;
        }

        return matchesLifecycleFilter(lifecycleStatus, parsedFilters.filters.status);
      })
      .map((report: MapReportRecord) => {
        const { user, ...publicReport } = report;
        return { ...publicReport, reporterName: user?.fullName?.trim() || "Reporter information unavailable", type: "flood_report" as const };
      })
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

    const mappedEvacuationCenters = (await getPublicEvacuationCenters()).map((center) => ({
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
        scopeVersion: BULACAN_SCOPE_VERSION,
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
