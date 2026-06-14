const REPORT_IMAGE_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

const REPORT_IMAGE_ALLOWED_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
] as const;

export const REPORT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export function getReportImageAcceptValue() {
  return REPORT_IMAGE_ALLOWED_MIME_TYPES.join(",");
}

export function validateReportImageFile(file: {
  name: string;
  type: string;
  size: number;
}) {
  const normalizedName = file.name.toLowerCase();
  const hasAllowedExtension = REPORT_IMAGE_ALLOWED_EXTENSIONS.some((extension) =>
    normalizedName.endsWith(extension),
  );
  const hasAllowedMimeType = REPORT_IMAGE_ALLOWED_MIME_TYPES.includes(
    file.type as (typeof REPORT_IMAGE_ALLOWED_MIME_TYPES)[number],
  );

  if (!hasAllowedExtension || !hasAllowedMimeType) {
    return "Upload a JPG, PNG, or WEBP image only.";
  }

  if (file.size > REPORT_IMAGE_MAX_BYTES) {
    return "Image must be 5 MB or smaller.";
  }

  return null;
}
