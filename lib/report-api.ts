import { OUTSIDE_CALUMPIT_ERROR_MESSAGE, isWithinCalumpit } from "@/lib/calumpit-boundary";
import { uploadReportImageToCloudinary } from "@/lib/cloudinary";
import {
  REPORT_MULTIPART_MAX_BYTES,
  validateReportImageBuffer,
  validateReportImageFile,
} from "@/lib/report-image-validation";
import {
  parseGpsAccuracyMeters,
  parsePhotoCapturedAt,
  parseReportLocationSource,
} from "@/lib/report-location-metadata";
import { isSupportedReportCategory } from "@/lib/reporting";
import {
  isValidLatitude,
  isValidLongitude,
  isValidReportSeverity,
  roundCoordinate,
} from "@/lib/validations";

export const REPORT_OWNER_FORBIDDEN_MESSAGE =
  "Only the original uploader can edit this report.";

export type ReportUpdateRecord = {
  id: string;
  message: string;
  updateType: string;
  imageUrl: string | null;
  severity: string | null;
  status: string | null;
  createdAt: Date;
};

export type ReportConfirmationRecord = {
  confirmationType: string;
  createdAt: Date;
};

export type ReportIdentity = {
  sessionHash?: string;
  userId?: string;
  role?: string;
};

export type PublicReportRecord = {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  status: string;
  locationName: string;
  latitude: number;
  longitude: number;
  locationSource: string;
  gpsAccuracyMeters: number | null;
  imageUrl: string | null;
  photoCapturedAt: Date | null;
  ownerSessionHash?: string | null;
  userId?: string | null;
  reportedByName: string | null;
  sourceType: "Community" | "Official" | "System";
  confirmationCount: number;
  resolvedCount: number;
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt: Date;
  resolvedAt: Date | null;
  archivedAt: Date | null;
  confirmations?: ReportConfirmationRecord[];
  updates?: ReportUpdateRecord[];
};

export const reportDetailInclude = {
  updates: {
    orderBy: {
      createdAt: "desc" as const,
    },
  },
  confirmations: {
    select: {
      confirmationType: true,
      createdAt: true,
    },
  },
} as const;

export const reportListInclude = {
  confirmations: {
    select: {
      confirmationType: true,
      createdAt: true,
    },
  },
} as const;

export function isReportOwner(
  report: Pick<PublicReportRecord, "ownerSessionHash" | "userId">,
  identity: ReportIdentity,
) {
  if (identity.role === "admin") {
    return true;
  }

  if (report.userId && identity.userId) {
    return report.userId === identity.userId;
  }

  return Boolean(
    report.ownerSessionHash &&
      identity.sessionHash &&
      report.ownerSessionHash === identity.sessionHash,
  );
}

export function canAccessArchivedReport(
  report: Pick<PublicReportRecord, "ownerSessionHash" | "userId">,
  identity: ReportIdentity,
  includeArchived: boolean,
) {
  return includeArchived && isReportOwner(report, identity);
}

export function serializeReportRecord<T extends PublicReportRecord>(
  report: T,
  identity: ReportIdentity = {},
) {
  const confirmations = report.confirmations ?? [];
  const lastConfirmedAt =
    confirmations
      .filter((entry) => entry.confirmationType === "confirmed")
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0]
      ?.createdAt ?? null;
  const lastResolvedConfirmationAt =
    confirmations
      .filter((entry) => entry.confirmationType === "resolved")
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0]
      ?.createdAt ?? null;

  const safeReport = { ...report };
  const owner = isReportOwner(report, identity);
  delete safeReport.ownerSessionHash;
  delete safeReport.userId;
  delete safeReport.confirmations;
  if (!owner) {
    safeReport.reportedByName = null;
  }

  return {
    ...safeReport,
    isOwner: owner,
    lastConfirmedAt: lastConfirmedAt?.toISOString() ?? null,
    lastResolvedConfirmationAt: lastResolvedConfirmationAt?.toISOString() ?? null,
  };
}

export function trimText(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/\s+/g, " ");
}

export function getOptionalText(value: unknown) {
  const trimmed = trimText(value);
  return trimmed.length > 0 ? trimmed : undefined;
}

export async function parseReportRequestFormData(request: Request) {
  const contentLength = Number(request.headers.get("content-length"));

  if (Number.isFinite(contentLength) && contentLength > REPORT_MULTIPART_MAX_BYTES) {
    return {
      error: "Report form data must not exceed 5.25 MB.",
      status: 413,
    };
  }

  try {
    const formData = await request.formData();
    let parsedSize = 0;

    for (const value of formData.values()) {
      parsedSize += typeof value === "string" ? Buffer.byteLength(value) : value.size;
    }

    if (parsedSize > REPORT_MULTIPART_MAX_BYTES) {
      return {
        error: "Report form data must not exceed 5.25 MB.",
        status: 413,
      };
    }

    return {
      formData,
    };
  } catch {
    return {
      error: "Invalid multipart form data.",
      status: 400,
    };
  }
}

export async function uploadReportImageFile(imageFile: File) {
  const imageValidationError = validateReportImageFile(imageFile);

  if (imageValidationError) {
    return { error: imageValidationError };
  }

  const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
  const imageContentError = validateReportImageBuffer(imageBuffer, imageFile.type);

  if (imageContentError) {
    return { error: imageContentError, status: 400 };
  }

  try {
    return {
      imageUrl: await uploadReportImageToCloudinary(imageBuffer, imageFile.name),
    };
  } catch (error) {
    console.error("Failed to upload report image.", error);
    return {
      error: "Image storage is temporarily unavailable. Submit the report without an image or try again later.",
      status: 503,
    };
  }
}

export function parseReportDetailsFormData(formData: FormData, now: Date = new Date()) {
  const title = getOptionalText(formData.get("title"));
  const description = getOptionalText(formData.get("description"));
  const category = getOptionalText(formData.get("category"));
  const severity = getOptionalText(formData.get("severity"));
  const locationName = getOptionalText(formData.get("locationName"));
  const reportedByName = getOptionalText(formData.get("reportedByName"));
  const rawLatitude = Number(formData.get("latitude"));
  const rawLongitude = Number(formData.get("longitude"));
  const forceNewIncident = formData.get("forceNewIncident") === "true";
  const locationSource = parseReportLocationSource(formData.get("locationSource"));
  const gpsAccuracyMeters = parseGpsAccuracyMeters(
    formData.get("gpsAccuracyMeters"),
    locationSource,
  );
  const photoCapturedAt = parsePhotoCapturedAt(formData.get("photoCapturedAt"), now);

  if (!title) {
    return { error: "Title is required." };
  }

  if (title.length > 120) {
    return { error: "Title must not exceed 120 characters." };
  }

  if (!description) {
    return { error: "Description is required." };
  }

  if (description.length > 1000) {
    return { error: "Description must not exceed 1000 characters." };
  }

  if (!category) {
    return { error: "Category is required." };
  }

  if (!isSupportedReportCategory(category)) {
    return { error: "Invalid category value." };
  }

  if (!severity) {
    return { error: "Severity is required." };
  }

  if (!isValidReportSeverity(severity)) {
    return { error: "Invalid severity value." };
  }

  if (!locationName) {
    return { error: "Location name is required." };
  }

  if (locationName.length > 160) {
    return { error: "Location name must not exceed 160 characters." };
  }

  if (!Number.isFinite(rawLatitude) || !isValidLatitude(rawLatitude)) {
    return { error: "Invalid latitude value." };
  }

  if (!Number.isFinite(rawLongitude) || !isValidLongitude(rawLongitude)) {
    return { error: "Invalid longitude value." };
  }

  // Normalize before the boundary test so the value that gets validated is
  // exactly the value that gets stored.
  const latitude = roundCoordinate(rawLatitude);
  const longitude = roundCoordinate(rawLongitude);

  if (!isWithinCalumpit(latitude, longitude)) {
    return { error: OUTSIDE_CALUMPIT_ERROR_MESSAGE };
  }

  if (reportedByName && reportedByName.length > 80) {
    return { error: "Reported by name must not exceed 80 characters." };
  }

  // `data` holds FloodReport columns only, so callers can spread it straight
  // into a Prisma create/update. `forceNewIncident` is a submission flag that
  // steers incident matching, not a column - it stays a sibling key.
  return {
    data: {
      title,
      description,
      category,
      severity,
      locationName,
      reportedByName,
      latitude,
      longitude,
      locationSource,
      gpsAccuracyMeters,
      photoCapturedAt,
    },
    forceNewIncident,
  };
}

export function parseReportUpdateFormData(formData: FormData) {
  const message =
    getOptionalText(formData.get("message")) ?? getOptionalText(formData.get("description"));
  const severity = getOptionalText(formData.get("severity"));

  if (!message) {
    return { error: "Update message is required." };
  }

  if (message.length > 1000) {
    return { error: "Update message must not exceed 1000 characters." };
  }

  if (severity && !isValidReportSeverity(severity)) {
    return { error: "Invalid severity value." };
  }

  return {
    data: {
      message,
      severity,
    },
  };
}
