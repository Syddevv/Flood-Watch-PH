import { errorResponse } from "@/lib/api-response";
import {
  clampLimit,
  parsePositiveInteger,
  parseReportFilters,
} from "@/lib/api-utils";
import { getAuthenticatedUserFromRequest } from "@/lib/auth-session";
import { BULACAN_BOUNDS, isWithinBulacan } from "@/lib/bulacan-scope";
import { INCIDENT_MATCH_RADIUS_METERS } from "@/lib/incident-config";
import { findNearestMatchingReport } from "@/lib/incident-matching";
import { createBoundingBox } from "@/lib/report-geo";
import {
  deriveReportLifecycleStatus,
  isVisiblePublicLifecycleStatus,
  matchesLifecycleFilter,
  type ReportLifecycleStatus,
} from "@/lib/report-lifecycle";
import { compareReportsByPriority } from "@/lib/report-trust";
import { isReportDatabaseUnavailableError } from "@/lib/report-db-errors";
import {
  acquireIncidentGeoLocks,
  lockIncidentForUpdate,
  prisma,
  type PrismaTransactionClient,
} from "@/lib/prisma";
import {
  canAccessArchivedReport,
  parseReportDetailsFormData,
  parseReportRequestFormData,
  reportListInclude,
  serializeReportRecord,
  isReportOwner,
  uploadReportImageFile,
  type ReportIdentity,
} from "@/lib/report-api";
import { getReportIdentityFromRequest } from "@/lib/report-identity";
import { protectApiRequest } from "@/lib/request-security";
import { validateOnsiteReportEvidence } from "@/lib/onsite-report-policy";
import { logApiError } from "@/lib/structured-logger";
import { createAdminNotifications, getAdminSettings } from "@/lib/admin-settings-store";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MAX_REPORTS_TO_PROCESS = 500;

async function notifyNewReport(tx: PrismaTransactionClient, report: { id: string; title: string; locationName: string; severity: string; createdAt: Date }) {
  const settings = await getAdminSettings(tx);
  const detail = `${report.title} · ${report.locationName} · Submitted ${report.createdAt.toISOString()} · Pending verification`;
  if (settings.newReportAlerts) await createAdminNotifications(tx, {
    type: "new_flood_report", title: "New flood report awaiting review", detail,
    targetType: "FloodReport", targetId: report.id, dedupeKey: `new-report:${report.id}`,
  });
  if (settings.highSeverityAlerts && ["High", "Critical"].includes(report.severity)) await createAdminNotifications(tx, {
    type: "high_severity_report", title: `${report.severity} severity report · unverified`, detail,
    targetType: "FloodReport", targetId: report.id, priority: "urgent", dedupeKey: `high-report:${report.id}`,
  });
}

function buildReportListResponse(
  data: ReportListRecord[],
  pagination: {
    page: number;
    limit: number;
    total: number;
    identity: ReportIdentity;
  },
) {
  return Response.json({
    data: data.map((report: ReportListRecord) => {
      const serialized = serializeReportRecord(report, pagination.identity);
      const { incident, ...rest } = serialized;

      return {
        ...rest,
        incidentReportCount: incident?.reportCount ?? 1,
      };
    }),
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: Math.max(1, Math.ceil(pagination.total / pagination.limit)),
    },
  });
}

type ReportListRecord = {
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
  locationSource: string;
  gpsAccuracyMeters: number | null;
  imageUrl: string | null;
  photoCapturedAt: Date | null;
  ownerSessionHash: string | null;
  userId: string | null;
  reportedByName: string | null;
  user?: { fullName: string | null } | null;
  sourceType: "Community" | "Official" | "System";
  confirmationCount: number;
  resolvedCount: number;
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt: Date;
  resolvedAt: Date | null;
  archivedAt: Date | null;
  incidentId: string;
  incident?: { reportCount: number };
  confirmations?: Array<{
    confirmationType: string;
    createdAt: Date;
  }>;
};

type ReportConfirmationSummary = NonNullable<ReportListRecord["confirmations"]>[number];

type ReportWhereClause = {
  severity?: string;
  category?: string;
  sourceType?: string;
  incidentId?: string;
  latitude?: { gte: number; lte: number };
  longitude?: { gte: number; lte: number };
  OR?: Array<{
    title?: { contains: string; mode: "insensitive" };
    description?: { contains: string; mode: "insensitive" };
    locationName?: { contains: string; mode: "insensitive" };
  }>;
};

function buildReportWhereClause(filters: {
  severity?: string;
  category?: string;
  sourceType?: string;
  search?: string;
  incidentId?: string;
}): ReportWhereClause {
  // Public listings only ever show reports inside the supported reporting
  // area. The bounding box is a cheap index-backed pre-filter; the exact
  // polygon check happens in JS below (Prisma can't do point-in-polygon).
  const [[minLatitude, minLongitude], [maxLatitude, maxLongitude]] = BULACAN_BOUNDS;

  return {
    latitude: { gte: minLatitude, lte: maxLatitude },
    longitude: { gte: minLongitude, lte: maxLongitude },
    ...(filters.severity ? { severity: filters.severity } : {}),
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.sourceType ? { sourceType: filters.sourceType } : {}),
    ...(filters.incidentId ? { incidentId: filters.incidentId } : {}),
    ...(filters.search
      ? {
          OR: [
            { title: { contains: filters.search, mode: "insensitive" } },
            { description: { contains: filters.search, mode: "insensitive" } },
            { locationName: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

function reconcileReportLifecycle(report: ReportListRecord): ReportListRecord {
  return {
    ...report,
    status: deriveReportLifecycleStatus(report) as ReportLifecycleStatus,
  };
}

export async function GET(request: Request) {
  try {
    const protectionResponse = await protectApiRequest(request, {
      scope: "reports-list",
      limit: 120,
      windowMs: 60 * 1000,
    });

    if (protectionResponse) {
      return protectionResponse;
    }

    const { searchParams } = new URL(request.url);
    const parsedFilters = parseReportFilters(searchParams);
    const identity = await getReportIdentityFromRequest(request);

    if (parsedFilters.error) {
      return errorResponse(parsedFilters.error, 400);
    }

    const includeArchived = searchParams.get("includeArchived") === "true";
    const page = parsePositiveInteger(searchParams.get("page"), 1);
    const limit = clampLimit(
      parsePositiveInteger(searchParams.get("limit"), DEFAULT_LIMIT),
      MAX_LIMIT,
    );
    const where = buildReportWhereClause({
      severity: parsedFilters.filters.severity,
      category: parsedFilters.filters.category,
      sourceType: parsedFilters.filters.sourceType,
      search: parsedFilters.filters.search,
      incidentId: parsedFilters.filters.incidentId,
    });

    const reports = (await prisma.floodReport.findMany({
      where,
      include: {
        user: { select: { fullName: true } },
        incident: {
          select: {
            reportCount: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: MAX_REPORTS_TO_PROCESS,
    })) as ReportListRecord[];

    if (reports.length === 0) {
      return buildReportListResponse([], { page, limit, total: 0, identity });
    }

    const confirmations = await prisma.reportConfirmation.findMany({
      where: {
        reportId: {
          in: reports.map((report: ReportListRecord) => report.id),
        },
      },
      select: {
        reportId: true,
        confirmationType: true,
        createdAt: true,
      },
    });
    const confirmationsByReportId = new Map<
      string,
      NonNullable<ReportListRecord["confirmations"]>
    >();

    for (const confirmation of confirmations) {
      const existing = confirmationsByReportId.get(confirmation.reportId) ?? [];
      existing.push({
        confirmationType: confirmation.confirmationType,
        createdAt: confirmation.createdAt,
      });
      confirmationsByReportId.set(confirmation.reportId, existing);
    }

    const reportsWithConfirmations: ReportListRecord[] = reports.map(
      (report: ReportListRecord) => ({
      ...report,
      confirmations: confirmationsByReportId.get(report.id) ?? [],
      }),
    );

    const reconciledReports = reportsWithConfirmations.map(reconcileReportLifecycle);

    const filteredReports = reconciledReports.filter((report: ReportListRecord) => {
      if (!isWithinBulacan(report.latitude, report.longitude)) {
        return false;
      }
      if (report.verificationStatus === "rejected" && !isReportOwner(report, identity)) return false;

      const lifecycleStatus = report.status as ReportLifecycleStatus;

      if (!isVisiblePublicLifecycleStatus(lifecycleStatus)) {
        return canAccessArchivedReport(report, identity, includeArchived);
      }

      return matchesLifecycleFilter(lifecycleStatus, parsedFilters.filters.status);
    });

    filteredReports.sort((left: ReportListRecord, right: ReportListRecord) =>
      compareReportsByPriority(
        {
          createdAt: left.createdAt,
          updatedAt: left.updatedAt,
          lastActivityAt: left.lastActivityAt,
          lastConfirmedAt:
            left.confirmations
              ?.filter(
                (entry: ReportConfirmationSummary) =>
                  entry.confirmationType === "confirmed",
              )
              .sort(
                (a: ReportConfirmationSummary, b: ReportConfirmationSummary) =>
                  b.createdAt.getTime() - a.createdAt.getTime(),
              )[0]
              ?.createdAt ?? null,
          confirmationCount: left.confirmationCount,
          resolvedCount: left.resolvedCount,
          severity: left.severity,
          status: left.status,
        },
        {
          createdAt: right.createdAt,
          updatedAt: right.updatedAt,
          lastActivityAt: right.lastActivityAt,
          lastConfirmedAt:
            right.confirmations
              ?.filter(
                (entry: ReportConfirmationSummary) =>
                  entry.confirmationType === "confirmed",
              )
              .sort(
                (a: ReportConfirmationSummary, b: ReportConfirmationSummary) =>
                  b.createdAt.getTime() - a.createdAt.getTime(),
              )[0]
              ?.createdAt ?? null,
          confirmationCount: right.confirmationCount,
          resolvedCount: right.resolvedCount,
          severity: right.severity,
          status: right.status,
        },
      ),
    );

    const total = filteredReports.length;
    const skip = (page - 1) * limit;
    const paginatedReports = filteredReports.slice(skip, skip + limit);

    return buildReportListResponse(paginatedReports as ReportListRecord[], {
      page,
      limit,
      total,
      identity,
    });
  } catch (error) {
    logApiError("reports-fetch-failed", request, error);

    if (isReportDatabaseUnavailableError(error)) {
      return errorResponse(
        "Report data is temporarily unavailable. Please try again later.",
        503,
      );
    }

    return errorResponse("Something went wrong while fetching reports.");
  }
}

export async function POST(request: Request) {
  try {
    const protectionResponse = await protectApiRequest(request, {
      scope: "report-create",
      limit: 5,
      windowMs: 60 * 60 * 1000,
      requireTrustedOrigin: true,
    });

    if (protectionResponse) {
      return protectionResponse;
    }

    const authenticatedUser = await getAuthenticatedUserFromRequest(request);

    if (!authenticatedUser) {
      return errorResponse("You must be signed in to submit a report.", 401);
    }
    if (!authenticatedUser.fullName) {
      return errorResponse("Add your full name to your profile before submitting a report. Visit /profile.", 403);
    }

    const parsedFormData = await parseReportRequestFormData(request);

    if (parsedFormData.error || !parsedFormData.formData) {
      return errorResponse(
        parsedFormData.error ?? "Invalid multipart form data.",
        parsedFormData.status ?? 400,
      );
    }

    const formData = parsedFormData.formData;
    const imageFile = formData.get("image");

    if (imageFile && typeof imageFile === "string") {
      return errorResponse("Invalid image upload.", 400);
    }

    const parsedReport = parseReportDetailsFormData(formData);

    if (parsedReport.error || !parsedReport.data) {
      return errorResponse(parsedReport.error ?? "Invalid report details.", 400);
    }

    const imagePresent = imageFile instanceof File && imageFile.size > 0;
    const onsiteEvidence = validateOnsiteReportEvidence(formData, {
      reportLatitude: parsedReport.data.latitude,
      reportLongitude: parsedReport.data.longitude,
      imagePresent,
    });

    if (onsiteEvidence.error || !onsiteEvidence.data) {
      return Response.json(
        { error: onsiteEvidence.error ?? "Invalid onsite evidence.", code: onsiteEvidence.code },
        { status: 422 },
      );
    }

    let imageUrl: string | undefined;

    if (imageFile instanceof File && imageFile.size > 0) {
      const uploadResult = await uploadReportImageFile(imageFile);

      if (uploadResult.error) {
        return errorResponse(uploadResult.error, uploadResult.status ?? 400);
      }

      imageUrl = uploadResult.imageUrl;
    }

    const {
      title,
      description,
      category,
      severity,
      locationName,
      latitude,
      longitude,
      locationSource,
    } = parsedReport.data;
    const { forceNewIncident } = parsedReport;
    const {
      gpsLatitude,
      gpsLongitude,
      gpsAccuracyMeters: onsiteGpsAccuracyMeters,
      gpsCapturedAt,
      photoCapturedAt,
      policyVersion: onsitePolicyVersion,
    } = onsiteEvidence.data;

    const now = new Date();
    const { report, incident } = await prisma.$transaction(
      async (tx: PrismaTransactionClient) => {
        await acquireIncidentGeoLocks(tx, latitude, longitude);

        const bounds = createBoundingBox(latitude, longitude, INCIDENT_MATCH_RADIUS_METERS);
        const candidates = await tx.floodReport.findMany({
          where: {
            verificationStatus: { not: "rejected" },
            latitude: { gte: bounds.minLatitude, lte: bounds.maxLatitude },
            longitude: { gte: bounds.minLongitude, lte: bounds.maxLongitude },
          },
          select: {
            incidentId: true,
            latitude: true,
            longitude: true,
            status: true,
            severity: true,
            confirmationCount: true,
            resolvedCount: true,
            createdAt: true,
            updatedAt: true,
            lastActivityAt: true,
            resolvedAt: true,
            archivedAt: true,
          },
          take: 100,
        });

        const match = findNearestMatchingReport(candidates, { latitude, longitude }, now);

        if (match && !forceNewIncident) {
          await lockIncidentForUpdate(tx, match.incidentId);

          const [createdReport, updatedIncident] = await Promise.all([
            tx.floodReport.create({
              data: {
                title,
                description,
                category,
                severity,
                status: "Needs More Confirmation",
                locationName,
                latitude,
                longitude,
                locationSource,
                gpsAccuracyMeters: onsiteGpsAccuracyMeters,
                gpsLatitude,
                gpsLongitude,
                gpsCapturedAt,
                imageUrl,
                photoCapturedAt,
                onsitePolicyVersion,
                onsiteEligibleAt: now,
                userId: authenticatedUser.id,
                reportedByName: null,
                sourceType: "Community",
                confirmationCount: 0,
                resolvedCount: 0,
                lastActivityAt: now,
                incidentId: match.incidentId,
              },
              include: reportListInclude,
            }),
            tx.incident.update({
              where: { id: match.incidentId },
              data: {
                reportCount: { increment: 1 },
                lastActivityAt: now,
              },
            }),
          ]);

          await notifyNewReport(tx, createdReport);
          return {
            report: createdReport,
            incident: { id: updatedIncident.id, matchedExisting: true as const, contributingReportCount: updatedIncident.reportCount },
          };
        }

        const newIncident = await tx.incident.create({
          data: {
            status: "Needs More Confirmation",
            representativeLatitude: latitude,
            representativeLongitude: longitude,
            locationName,
            severity,
            reportCount: 1,
            firstReportAt: now,
            lastActivityAt: now,
          },
        });

        const createdReport = await tx.floodReport.create({
          data: {
            title,
            description,
            category,
            severity,
            status: "Needs More Confirmation",
            locationName,
            latitude,
            longitude,
            locationSource,
            gpsAccuracyMeters: onsiteGpsAccuracyMeters,
            gpsLatitude,
            gpsLongitude,
            gpsCapturedAt,
            imageUrl,
            photoCapturedAt,
            onsitePolicyVersion,
            onsiteEligibleAt: now,
            userId: authenticatedUser.id,
            reportedByName: null,
            sourceType: "Community",
            confirmationCount: 0,
            resolvedCount: 0,
            lastActivityAt: now,
            incidentId: newIncident.id,
          },
          include: reportListInclude,
        });

        await notifyNewReport(tx, createdReport);
        return {
          report: createdReport,
          incident: {
            id: newIncident.id,
            matchedExisting: false as const,
            contributingReportCount: newIncident.reportCount,
          },
        };
      },
      { timeout: 10_000 },
    );

    return Response.json(
      {
        data: {
          ...serializeReportRecord(report as ReportListRecord, {
            userId: authenticatedUser.id,
            role: authenticatedUser.role,
          }),
          incident,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    logApiError("report-create-failed", request, error);

    if (isReportDatabaseUnavailableError(error)) {
      return errorResponse(
        "Unable to save the report because the database connection is unavailable. Check your Supabase database URL and try again.",
        503,
      );
    }

    return errorResponse("Something went wrong while creating the report.");
  }
}
