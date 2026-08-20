import { errorResponse, successResponse } from "@/lib/api-response";
import { createBoundingBox, calculateDistanceMeters } from "@/lib/report-geo";
import {
  deriveReportLifecycleStatus,
  isActiveLifecycleStatus,
  type ReportLifecycleStatus,
} from "@/lib/report-lifecycle";
import { prisma } from "@/lib/prisma";
import { serializeReportRecord } from "@/lib/report-api";
import { getReportSessionHashFromRequest } from "@/lib/report-session";
import { protectApiRequest } from "@/lib/request-security";
import { isValidLatitude, isValidLongitude } from "@/lib/validations";

const DEFAULT_RADIUS_METERS = 300;
const MAX_RADIUS_METERS = 500;
const DEFAULT_LIMIT = 3;

type NearbyReportRecord = {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  status: string;
  locationName: string;
  latitude: number;
  longitude: number;
  imageUrl: string | null;
  ownerSessionHash: string | null;
  reportedByName: string | null;
  sourceType: "Community" | "Official" | "System";
  confirmationCount: number;
  resolvedCount: number;
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt: Date;
  resolvedAt: Date | null;
  archivedAt: Date | null;
  confirmations: Array<{
    confirmationType: string;
    createdAt: Date;
  }>;
};

const nearbyInclude = {
  confirmations: {
    select: {
      confirmationType: true,
      createdAt: true,
    },
  },
} as const;

function clampRadiusMeters(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_RADIUS_METERS;
  }

  return Math.min(parsed, MAX_RADIUS_METERS);
}

function clampLimit(value: string | null) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_LIMIT;
  }

  return Math.min(parsed, 5);
}

function serializeNearbyReport(
  report: NearbyReportRecord,
  distanceMeters: number,
  sessionHash: string,
) {
  return {
    ...serializeReportRecord(report, sessionHash),
    distanceMeters,
  };
}

type NearbyReportDistanceEntry = {
  report: NearbyReportRecord;
  distanceMeters: number;
};

function reconcileNearbyReport(report: NearbyReportRecord): NearbyReportRecord {
  return {
    ...report,
    status: deriveReportLifecycleStatus(report),
  };
}

export async function GET(request: Request) {
  try {
    const protectionResponse = await protectApiRequest(request, {
      scope: "reports-nearby",
      limit: 60,
      windowMs: 60 * 1000,
    });

    if (protectionResponse) {
      return protectionResponse;
    }

    const { searchParams } = new URL(request.url);
    const sessionHash = getReportSessionHashFromRequest(request);
    const latitude = Number(searchParams.get("lat"));
    const longitude = Number(searchParams.get("lng"));
    const radiusMeters = clampRadiusMeters(searchParams.get("radiusMeters"));
    const limit = clampLimit(searchParams.get("limit"));

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      !isValidLatitude(latitude) ||
      !isValidLongitude(longitude)
    ) {
      return errorResponse("Latitude and longitude are required.", 400);
    }

    const bounds = createBoundingBox(latitude, longitude, radiusMeters);
    const reports = (await prisma.floodReport.findMany({
      where: {
        latitude: {
          gte: bounds.minLatitude,
          lte: bounds.maxLatitude,
        },
        longitude: {
          gte: bounds.minLongitude,
          lte: bounds.maxLongitude,
        },
      },
      include: nearbyInclude,
      take: 100,
    })) as NearbyReportRecord[];

    const reconciledReports = reports.map(reconcileNearbyReport);

    const nearbyReports = reconciledReports
      .filter((report: NearbyReportRecord) =>
        isActiveLifecycleStatus(report.status as ReportLifecycleStatus),
      )
      .map((report: NearbyReportRecord): NearbyReportDistanceEntry => {
        const distanceMeters = calculateDistanceMeters(
          { latitude, longitude },
          { latitude: report.latitude, longitude: report.longitude },
        );

        return {
          report,
          distanceMeters,
        };
      })
      .filter((entry: NearbyReportDistanceEntry) => entry.distanceMeters <= radiusMeters)
      .sort(
        (left: NearbyReportDistanceEntry, right: NearbyReportDistanceEntry) =>
          left.distanceMeters - right.distanceMeters,
      )
      .slice(0, limit)
      .map((entry: NearbyReportDistanceEntry) =>
        serializeNearbyReport(entry.report, entry.distanceMeters, sessionHash),
      );

    return successResponse(nearbyReports);
  } catch (error) {
    console.error("Failed to fetch nearby reports.", error);
    return errorResponse("Something went wrong while checking nearby reports.");
  }
}
