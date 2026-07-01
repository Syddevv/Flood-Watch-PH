import { errorResponse, successResponse } from "@/lib/api-response";
import { createBoundingBox, calculateDistanceMeters } from "@/lib/report-geo";
import {
  applyReportLifecycleUpdates,
  getLifecyclePersistencePatch,
  isActiveLifecycleStatus,
  type ReportLifecycleStatus,
} from "@/lib/report-lifecycle";
import { prisma } from "@/lib/prisma";
import { serializeReportRecord } from "@/lib/report-api";
import { getReportSessionHashFromRequest } from "@/lib/report-session";
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

async function reconcileNearbyReport(
  report: NearbyReportRecord,
): Promise<NearbyReportRecord> {
  const nextLifecycle = applyReportLifecycleUpdates(report);
  const patch = getLifecyclePersistencePatch(report);
  if (Object.keys(patch).length === 0) {
    return {
      ...report,
      status: nextLifecycle.status,
    };
  }

  try {
    const updatedReport: NearbyReportRecord = await prisma.floodReport.update({
      where: { id: report.id },
      data: patch,
      include: nearbyInclude,
    });

    return updatedReport;
  } catch (error) {
    console.warn("Failed to persist nearby report lifecycle update.", error);

    return {
      ...report,
      ...nextLifecycle,
    };
  }
}

export async function GET(request: Request) {
  try {
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
    const reports: NearbyReportRecord[] = await prisma.floodReport.findMany({
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
    });

    const reconciledReports: NearbyReportRecord[] = await Promise.all(
      reports.map((report: NearbyReportRecord) => reconcileNearbyReport(report)),
    );

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
