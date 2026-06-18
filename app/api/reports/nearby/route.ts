import { errorResponse, successResponse } from "@/lib/api-response";
import { createBoundingBox, calculateDistanceMeters } from "@/lib/report-geo";
import {
  getLifecyclePersistencePatch,
  isActiveLifecycleStatus,
  type ReportLifecycleStatus,
} from "@/lib/report-lifecycle";
import { prisma } from "@/lib/prisma";

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

function serializeNearbyReport(report: NearbyReportRecord, distanceMeters: number) {
  const lastConfirmedAt =
    report.confirmations
      .filter((entry) => entry.confirmationType === "confirmed")
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0]
      ?.createdAt ?? null;
  const lastResolvedConfirmationAt =
    report.confirmations
      .filter((entry) => entry.confirmationType === "resolved")
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0]
      ?.createdAt ?? null;

  return {
    ...report,
    distanceMeters,
    lastConfirmedAt: lastConfirmedAt?.toISOString() ?? null,
    lastResolvedConfirmationAt: lastResolvedConfirmationAt?.toISOString() ?? null,
    confirmations: undefined,
  };
}

async function reconcileNearbyReport(report: NearbyReportRecord) {
  const patch = getLifecyclePersistencePatch(report);
  if (Object.keys(patch).length === 0) {
    return report;
  }

  return prisma.floodReport.update({
    where: { id: report.id },
    data: patch,
    include: nearbyInclude,
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const latitude = Number(searchParams.get("lat"));
    const longitude = Number(searchParams.get("lng"));
    const radiusMeters = clampRadiusMeters(searchParams.get("radiusMeters"));
    const limit = clampLimit(searchParams.get("limit"));

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return errorResponse("Latitude and longitude are required.", 400);
    }

    const bounds = createBoundingBox(latitude, longitude, radiusMeters);
    const reports = await prisma.floodReport.findMany({
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

    const reconciledReports = await Promise.all(
      reports.map((report) => reconcileNearbyReport(report as NearbyReportRecord)),
    );

    const nearbyReports = reconciledReports
      .filter((report) =>
        isActiveLifecycleStatus(report.status as ReportLifecycleStatus),
      )
      .map((report) => {
        const distanceMeters = calculateDistanceMeters(
          { latitude, longitude },
          { latitude: report.latitude, longitude: report.longitude },
        );

        return {
          report: report as NearbyReportRecord,
          distanceMeters,
        };
      })
      .filter((entry) => entry.distanceMeters <= radiusMeters)
      .sort((left, right) => left.distanceMeters - right.distanceMeters)
      .slice(0, limit)
      .map((entry) => serializeNearbyReport(entry.report, entry.distanceMeters));

    return successResponse(nearbyReports);
  } catch (error) {
    console.error("Failed to fetch nearby reports.", error);
    return errorResponse("Something went wrong while checking nearby reports.");
  }
}
