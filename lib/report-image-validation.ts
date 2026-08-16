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
export const REPORT_MULTIPART_MAX_BYTES = REPORT_IMAGE_MAX_BYTES + 256 * 1024;

const REPORT_IMAGE_MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export function getReportImageAcceptValue() {
  return REPORT_IMAGE_ALLOWED_MIME_TYPES.join(",");
}

export function validateReportImageFile(file: {
  name: string;
  type: string;
  size: number;
}) {
  const normalizedName = file.name.toLowerCase();
  const extension = REPORT_IMAGE_ALLOWED_EXTENSIONS.find((allowedExtension) =>
    normalizedName.endsWith(allowedExtension),
  );
  const hasAllowedMimeType = REPORT_IMAGE_ALLOWED_MIME_TYPES.includes(
    file.type as (typeof REPORT_IMAGE_ALLOWED_MIME_TYPES)[number],
  );

  if (
    !extension ||
    !hasAllowedMimeType ||
    REPORT_IMAGE_MIME_TYPE_BY_EXTENSION[extension] !== file.type
  ) {
    return "Upload a JPG, PNG, or WEBP image only.";
  }

  if (file.size > REPORT_IMAGE_MAX_BYTES) {
    return "Image must be 5 MB or smaller.";
  }

  return null;
}

function hasBytes(buffer: Buffer, expected: readonly number[], offset = 0) {
  return expected.every((byte, index) => buffer[offset + index] === byte);
}

export function validateReportImageBuffer(buffer: Buffer, mimeType: string) {
  const isValid =
    (mimeType === "image/jpeg" && hasBytes(buffer, [0xff, 0xd8, 0xff])) ||
    (mimeType === "image/png" &&
      hasBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
    (mimeType === "image/webp" &&
      hasBytes(buffer, [0x52, 0x49, 0x46, 0x46]) &&
      hasBytes(buffer, [0x57, 0x45, 0x42, 0x50], 8));

  return isValid ? null : "The uploaded file is not a valid JPG, PNG, or WEBP image.";
}
