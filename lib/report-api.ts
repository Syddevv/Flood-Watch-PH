import { Prisma } from "@prisma/client";

import { uploadReportImageToCloudinary } from "@/lib/cloudinary";
import { REPORT_STATUSES } from "@/lib/constants";
import { validateReportImageFile } from "@/lib/report-image-validation";
import { isSupportedReportCategory } from "@/lib/reporting";
import {
  isValidLatitude,
  isValidLongitude,
  isValidReportSeverity,
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
  imageUrl: string | null;
  ownerSessionHash?: string | null;
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
} satisfies Prisma.FloodReportInclude;

export const reportListInclude = {
  confirmations: {
    select: {
      confirmationType: true,
      createdAt: true,
    },
  },
} satisfies Prisma.FloodReportInclude;

export function isReportOwner(
  report: Pick<PublicReportRecord, "ownerSessionHash">,
  sessionHash: string,
) {
  return Boolean(report.ownerSessionHash && sessionHash && report.ownerSessionHash === sessionHash);
}

export function serializeReportRecord<T extends PublicReportRecord>(
  report: T,
  sessionHash = "",
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
  delete safeReport.ownerSessionHash;
  delete safeReport.confirmations;

  return {
    ...safeReport,
    isOwner: isReportOwner(report, sessionHash),
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

export function buildInlineImageDataUrl(fileBuffer: Buffer, mimeType: string) {
  return `data:${mimeType};base64,${fileBuffer.toString("base64")}`;
}

export async function uploadReportImageFile(imageFile: File) {
  const imageValidationError = validateReportImageFile(imageFile);

  if (imageValidationError) {
    return { error: imageValidationError };
  }

  const imageBuffer = Buffer.from(await imageFile.arrayBuffer());

  try {
    return {
      imageUrl: await uploadReportImageToCloudinary(imageBuffer, imageFile.name),
    };
  } catch (error) {
    console.error("Failed to upload report image.", error);
    return {
      imageUrl: buildInlineImageDataUrl(imageBuffer, imageFile.type),
    };
  }
}

export function parseReportDetailsFormData(formData: FormData) {
  const title = getOptionalText(formData.get("title"));
  const description = getOptionalText(formData.get("description"));
  const category = getOptionalText(formData.get("category"));
  const severity = getOptionalText(formData.get("severity"));
  const locationName = getOptionalText(formData.get("locationName"));
  const reportedByName = getOptionalText(formData.get("reportedByName"));
  const latitude = Number(formData.get("latitude"));
  const longitude = Number(formData.get("longitude"));

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

  if (!Number.isFinite(latitude) || !isValidLatitude(latitude)) {
    return { error: "Invalid latitude value." };
  }

  if (!Number.isFinite(longitude) || !isValidLongitude(longitude)) {
    return { error: "Invalid longitude value." };
  }

  if (reportedByName && reportedByName.length > 80) {
    return { error: "Reported by name must not exceed 80 characters." };
  }

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
    },
  };
}

export function parseReportUpdateFormData(formData: FormData) {
  const message =
    getOptionalText(formData.get("message")) ?? getOptionalText(formData.get("description"));
  const severity = getOptionalText(formData.get("severity"));
  const status = getOptionalText(formData.get("status"));

  if (!message) {
    return { error: "Update message is required." };
  }

  if (message.length > 1000) {
    return { error: "Update message must not exceed 1000 characters." };
  }

  if (severity && !isValidReportSeverity(severity)) {
    return { error: "Invalid severity value." };
  }

  if (
    status &&
    (status === "Archived" || !REPORT_STATUSES.includes(status as (typeof REPORT_STATUSES)[number]))
  ) {
    return { error: "Invalid status value." };
  }

  return {
    data: {
      message,
      severity,
      status,
    },
  };
}
