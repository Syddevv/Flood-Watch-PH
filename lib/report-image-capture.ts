/**
 * In-browser photo capture: the pure half.
 *
 * Sizing maths, file naming, capability detection and error wording live here
 * so they can be unit-tested without a DOM. The half that actually touches
 * <canvas>, <video> and getUserMedia lives in lib/report-image-browser.ts.
 *
 * Two constraints from lib/report-image-validation.ts shape everything below:
 * the upload cap is 5 MB, and the file extension must agree with the MIME
 * type - which is why captures are always JPEG named ".jpg".
 */

/** Long edge of a stored capture. Plenty to read a street sign from. */
export const REPORT_CAPTURE_MAX_EDGE_PX = 1600;

export const REPORT_CAPTURE_JPEG_QUALITY = 0.85;

export const REPORT_CAPTURE_MIME_TYPE = "image/jpeg";

export const REPORT_CAPTURE_FILE_EXTENSION = ".jpg";

/**
 * Uploads under this size pass through untouched. Re-encoding a small image
 * costs time and quality for a saving nobody notices.
 */
export const REPORT_UPLOAD_DOWNSCALE_THRESHOLD_BYTES = 1_500_000;

export const CAMERA_UNSUPPORTED_MESSAGE =
  "This browser can't open the camera. Upload a photo instead.";

const CAMERA_ERROR_MESSAGES: Record<string, string> = {
  NotAllowedError:
    "Camera permission was blocked. Allow camera access in your browser settings, or upload a photo instead.",
  SecurityError:
    "Camera permission was blocked. Allow camera access in your browser settings, or upload a photo instead.",
  NotFoundError: "No camera was found on this device. Upload a photo instead.",
  OverconstrainedError: "No camera was found on this device. Upload a photo instead.",
  NotReadableError:
    "The camera is in use by another app. Close it and try again, or upload a photo instead.",
  AbortError: "The camera stopped unexpectedly. Try again, or upload a photo instead.",
};

export type CaptureDimensions = {
  width: number;
  height: number;
};

/**
 * Aspect-preserving fit inside `maxEdge`. Never upscales: a 640x480 webcam
 * frame stays 640x480 rather than being stretched into a blurry 1600px image.
 * Returns zeros for unusable input so the caller can bail before drawing.
 */
export function getCaptureDimensions(
  width: number,
  height: number,
  maxEdge: number = REPORT_CAPTURE_MAX_EDGE_PX,
): CaptureDimensions {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return { width: 0, height: 0 };
  }

  const longestEdge = Math.max(width, height);

  if (longestEdge <= maxEdge) {
    return { width: Math.round(width), height: Math.round(height) };
  }

  const scale = maxEdge / longestEdge;

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function padTwo(value: number) {
  return String(value).padStart(2, "0");
}

/**
 * A sortable, human-readable name in the device's own local time. The `.jpg`
 * extension is load-bearing: `validateReportImageFile` rejects a JPEG that
 * claims any other extension.
 */
export function buildCaptureFileName(date: Date): string {
  const stamp =
    `${date.getFullYear()}${padTwo(date.getMonth() + 1)}${padTwo(date.getDate())}` +
    `-${padTwo(date.getHours())}${padTwo(date.getMinutes())}${padTwo(date.getSeconds())}`;

  return `flood-capture-${stamp}${REPORT_CAPTURE_FILE_EXTENSION}`;
}

export function shouldDownscaleImage(image: {
  sizeBytes: number;
  width: number;
  height: number;
}): boolean {
  return (
    image.sizeBytes > REPORT_UPLOAD_DOWNSCALE_THRESHOLD_BYTES ||
    Math.max(image.width, image.height) > REPORT_CAPTURE_MAX_EDGE_PX
  );
}

/**
 * Every message names uploading as the way forward - the camera is an
 * addition to the file picker, never a gate in front of it.
 */
export function describeCameraError(error: unknown): string {
  const name =
    error && typeof error === "object" && "name" in error
      ? String((error as { name: unknown }).name)
      : "";

  return CAMERA_ERROR_MESSAGES[name] ?? CAMERA_UNSUPPORTED_MESSAGE;
}

type NavigatorLike = {
  mediaDevices?: {
    getUserMedia?: unknown;
  };
};

/**
 * `isSecureContext` is passed in rather than read off the global so this stays
 * testable. It matters in practice: getUserMedia is unavailable over plain
 * HTTP, so a phone hitting a LAN dev server would see a button that cannot work.
 */
export function isCameraCaptureSupported(
  navigatorLike: NavigatorLike | undefined,
  isSecureContext: boolean,
): boolean {
  return Boolean(
    isSecureContext && typeof navigatorLike?.mediaDevices?.getUserMedia === "function",
  );
}
