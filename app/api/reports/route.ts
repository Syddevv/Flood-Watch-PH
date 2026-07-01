import { Prisma } from "@prisma/client";

import { errorResponse } from "@/lib/api-response";
import {
  clampLimit,
  parsePositiveInteger,
  parseReportFilters,
} from "@/lib/api-utils";
import {
  getLifecyclePersistencePatch,
  isVisiblePublicLifecycleStatus,
  matchesLifecycleFilter,
  type ReportLifecycleStatus,
} from "@/lib/report-lifecycle";
import { compareReportsByPriority } from "@/lib/report-trust";
import { prisma } from "@/lib/prisma";
import {
  parseReportDetailsFormData,
  reportListInclude,
  serializeReportRecord,
  uploadReportImageFile,
} from "@/lib/report-api";
import { getReportSessionHashFromRequest } from "@/lib/report-session";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function buildReportListResponse(
  data: ReportListRecord[],
  pagination: {
    page: number;
    limit: number;
    total: number;
    sessionHash: string;
  },
) {
  return Response.json({
    data: data.map((report) => serializeReportRecord(report, pagination.sessionHash)),
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: Math.max(1, Math.ceil(pagination.total / pagination.limit)),
    },
  });
}

function isReportDatabaseUnavailableError(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    ["EACCES", "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND"].includes(error.code)
  ) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return /\b(connect\s+)?(EACCES|ECONNREFUSED|ETIMEDOUT|ENOTFOUND)\b/i.test(
    error.message,
  );
}

function buildEmptyReportListResponseFromRequest(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parsePositiveInteger(searchParams.get("page"), 1);
  const limit = clampLimit(
    parsePositiveInteger(searchParams.get("limit"), DEFAULT_LIMIT),
    MAX_LIMIT,
  );

  return buildReportListResponse([], {
    page,
    limit,
    total: 0,
    sessionHash: getReportSessionHashFromRequest(request),
  });
}

type ReportListRecord = {
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
  confirmations?: Array<{
    confirmationType: string;
    createdAt: Date;
  }>;
};

type ReportConfirmationSummary = NonNullable<ReportListRecord["confirmations"]>[number];

function buildReportWhereClause(filters: {
  severity?: string;
  category?: string;
  sourceType?: string;
  search?: string;
}): Prisma.FloodReportWhereInput {
  return {
    ...(filters.severity ? { severity: filters.severity } : {}),
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.sourceType ? { sourceType: filters.sourceType } : {}),
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

async function reconcileReportLifecycle(report: ReportListRecord) {
  const now = new Date();
  const patch = getLifecyclePersistencePatch(report, now);

  if (Object.keys(patch).length === 0) {
    return {
      ...report,
      status: report.status as ReportLifecycleStatus,
    };
  }

  return prisma.floodReport.update({
    where: { id: report.id },
    data: patch,
    include: reportListInclude,
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsedFilters = parseReportFilters(searchParams);
    const sessionHash = getReportSessionHashFromRequest(request);

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
    });

    const reports = (await prisma.floodReport.findMany({
      where,
      orderBy: { createdAt: "desc" },
    })) as ReportListRecord[];

    if (reports.length === 0) {
      return buildReportListResponse([], { page, limit, total: 0, sessionHash });
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

    const reconciledReports: ReportListRecord[] = await Promise.all(
      reportsWithConfirmations.map((report: ReportListRecord) =>
        reconcileReportLifecycle(report),
      ),
    );

    const filteredReports = reconciledReports.filter((report: ReportListRecord) => {
      const lifecycleStatus = report.status as ReportLifecycleStatus;

      if (!includeArchived && !isVisiblePublicLifecycleStatus(lifecycleStatus)) {
        return false;
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
      sessionHash,
    });
  } catch (error) {
    console.error("Failed to fetch reports.", error);

    if (isReportDatabaseUnavailableError(error)) {
      return buildEmptyReportListResponseFromRequest(request);
    }

    return errorResponse("Something went wrong while fetching reports.");
  }
}

export async function POST(request: Request) {
  try {
    const sessionHash = getReportSessionHashFromRequest(request);
    const formData = await request.formData();
    const imageFile = formData.get("image");

    if (imageFile && typeof imageFile === "string") {
      return errorResponse("Invalid image upload.", 400);
    }

    const parsedReport = parseReportDetailsFormData(formData);

    if (parsedReport.error || !parsedReport.data) {
      return errorResponse(parsedReport.error ?? "Invalid report details.", 400);
    }

    let imageUrl: string | undefined;

    if (imageFile instanceof File && imageFile.size > 0) {
      const uploadResult = await uploadReportImageFile(imageFile);

      if (uploadResult.error) {
        return errorResponse(uploadResult.error, 400);
      }

      imageUrl = uploadResult.imageUrl;
    }

    const {
      title,
      description,
      category,
      severity,
      locationName,
      reportedByName,
      latitude,
      longitude,
    } = parsedReport.data;

    const report = await prisma.floodReport.create({
      data: {
        title,
        description,
        category,
        severity,
        status: "Needs More Confirmation",
        locationName,
        latitude,
        longitude,
        imageUrl,
        ownerSessionHash: sessionHash || undefined,
        reportedByName,
        sourceType: "Community",
        confirmationCount: 0,
        resolvedCount: 0,
        lastActivityAt: new Date(),
      },
      include: reportListInclude,
    });

    return Response.json(
      { data: serializeReportRecord(report as ReportListRecord, sessionHash) },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to create report.", error);

    if (isReportDatabaseUnavailableError(error)) {
      return errorResponse(
        "Unable to save the report because the database connection is unavailable. Check your Supabase database URL and try again.",
        503,
      );
    }

    return errorResponse("Something went wrong while creating the report.");
  }
}
