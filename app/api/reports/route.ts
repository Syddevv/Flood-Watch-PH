import { Prisma } from "@prisma/client";

import { errorResponse, successResponse } from "@/lib/api-response";
import {
  clampLimit,
  parsePositiveInteger,
  parseReportFilters,
  trimToUndefined,
} from "@/lib/api-utils";
import { uploadReportImageToCloudinary } from "@/lib/cloudinary";
import {
  getLifecyclePersistencePatch,
  isVisiblePublicLifecycleStatus,
  matchesLifecycleFilter,
  type ReportLifecycleStatus,
} from "@/lib/report-lifecycle";
import { prisma } from "@/lib/prisma";
import { validateReportImageFile } from "@/lib/report-image-validation";
import { isSupportedReportCategory } from "@/lib/reporting";
import {
  isValidLatitude,
  isValidLongitude,
  isValidReportSeverity,
} from "@/lib/validations";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

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
  reportedByName: string | null;
  sourceType: "Community" | "Official" | "System";
  confirmationCount: number;
  resolvedCount: number;
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt: Date;
  resolvedAt: Date | null;
  archivedAt: Date | null;
};

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
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsedFilters = parseReportFilters(searchParams);

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

    const reports = await prisma.floodReport.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    const reconciledReports = await Promise.all(
      reports.map((report) => reconcileReportLifecycle(report as ReportListRecord)),
    );

    const filteredReports = reconciledReports.filter((report) => {
      const lifecycleStatus = report.status as ReportLifecycleStatus;

      if (!includeArchived && !isVisiblePublicLifecycleStatus(lifecycleStatus)) {
        return false;
      }

      return matchesLifecycleFilter(lifecycleStatus, parsedFilters.filters.status);
    });

    const total = filteredReports.length;
    const skip = (page - 1) * limit;
    const paginatedReports = filteredReports.slice(skip, skip + limit);

    return Response.json({
      data: paginatedReports,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    console.error("Failed to fetch reports.", error);
    return errorResponse("Something went wrong while fetching reports.");
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get("image");

    if (imageFile && typeof imageFile === "string") {
      return errorResponse("Invalid image upload.", 400);
    }

    const title = trimToUndefined(formData.get("title"));
    const description = trimToUndefined(formData.get("description"));
    const category = trimToUndefined(formData.get("category"));
    const severity = trimToUndefined(formData.get("severity"));
    const locationName = trimToUndefined(formData.get("locationName"));
    const reportedByName = trimToUndefined(formData.get("reportedByName"));
    const latitude = Number(formData.get("latitude"));
    const longitude = Number(formData.get("longitude"));

    if (!title) {
      return errorResponse("Title is required.", 400);
    }

    if (title.length > 120) {
      return errorResponse("Title must not exceed 120 characters.", 400);
    }

    if (!description) {
      return errorResponse("Description is required.", 400);
    }

    if (description.length > 1000) {
      return errorResponse("Description must not exceed 1000 characters.", 400);
    }

    if (!category) {
      return errorResponse("Category is required.", 400);
    }

    if (!isSupportedReportCategory(category)) {
      return errorResponse("Invalid category value.", 400);
    }

    if (!severity) {
      return errorResponse("Severity is required.", 400);
    }

    if (!isValidReportSeverity(severity)) {
      return errorResponse("Invalid severity value.", 400);
    }

    if (!locationName) {
      return errorResponse("Location name is required.", 400);
    }

    if (locationName.length > 160) {
      return errorResponse("Location name must not exceed 160 characters.", 400);
    }

    if (!Number.isFinite(latitude) || !isValidLatitude(latitude)) {
      return errorResponse("Invalid latitude value.", 400);
    }

    if (!Number.isFinite(longitude) || !isValidLongitude(longitude)) {
      return errorResponse("Invalid longitude value.", 400);
    }

    if (reportedByName && reportedByName.length > 80) {
      return errorResponse("Reported by name must not exceed 80 characters.", 400);
    }

    let imageUrl: string | undefined;

    if (imageFile instanceof File && imageFile.size > 0) {
      const imageValidationError = validateReportImageFile(imageFile);

      if (imageValidationError) {
        return errorResponse(imageValidationError, 400);
      }

      const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
      imageUrl = await uploadReportImageToCloudinary(imageBuffer, imageFile.name);
    }

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
        reportedByName,
        sourceType: "Community",
        confirmationCount: 0,
        resolvedCount: 0,
        lastActivityAt: new Date(),
      },
    });

    return successResponse(report, { status: 201 });
  } catch (error) {
    console.error("Failed to create report.", error);
    return errorResponse(
      error instanceof Error
        ? error.message
        : "Something went wrong while creating the report.",
    );
  }
}
