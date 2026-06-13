import { Prisma } from "@prisma/client";

import { errorResponse, successResponse } from "@/lib/api-response";
import {
  clampLimit,
  parsePositiveInteger,
  parseReportFilters,
  trimToUndefined,
} from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import {
  isValidLatitude,
  isValidLongitude,
  isValidReportCategory,
  isValidReportSeverity,
} from "@/lib/validations";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function buildReportWhereClause(filters: {
  status?: string;
  severity?: string;
  category?: string;
  sourceType?: string;
  search?: string;
}): Prisma.FloodReportWhereInput {
  return {
    ...(filters.status ? { status: filters.status } : {}),
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsedFilters = parseReportFilters(searchParams);

    if (parsedFilters.error) {
      return errorResponse(parsedFilters.error, 400);
    }

    const page = parsePositiveInteger(searchParams.get("page"), 1);
    const limit = clampLimit(
      parsePositiveInteger(searchParams.get("limit"), DEFAULT_LIMIT),
      MAX_LIMIT,
    );
    const where = buildReportWhereClause(parsedFilters.filters);
    const skip = (page - 1) * limit;

    const [reports, total] = await Promise.all([
      prisma.floodReport.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.floodReport.count({ where }),
    ]);

    return Response.json({
      data: reports,
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
    const body = (await request.json()) as Record<string, unknown>;

    const title = trimToUndefined(body.title);
    const description = trimToUndefined(body.description);
    const category = trimToUndefined(body.category);
    const severity = trimToUndefined(body.severity);
    const locationName = trimToUndefined(body.locationName);
    const reportedByName = trimToUndefined(body.reportedByName);
    const latitude =
      typeof body.latitude === "number" ? body.latitude : Number(body.latitude);
    const longitude =
      typeof body.longitude === "number"
        ? body.longitude
        : Number(body.longitude);

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

    if (!isValidReportCategory(category)) {
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

    const report = await prisma.floodReport.create({
      data: {
        title,
        description,
        category,
        severity,
        status: "Active",
        locationName,
        latitude,
        longitude,
        reportedByName,
        sourceType: "Community",
        confirmationCount: 0,
        resolvedCount: 0,
      },
    });

    return successResponse(report, { status: 201 });
  } catch (error) {
    console.error("Failed to create report.", error);
    return errorResponse("Something went wrong while creating the report.");
  }
}
