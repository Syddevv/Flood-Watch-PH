"use client";

import {
  REPORT_CAPTURE_JPEG_QUALITY,
  REPORT_CAPTURE_MIME_TYPE,
  buildCaptureFileName,
  getCaptureDimensions,
  shouldDownscaleImage,
} from "@/lib/report-image-capture";

/**
 * The DOM half of photo capture. Everything here needs a real browser, so it
 * is covered by the Playwright specs rather than node:test; the decisions it
 * makes (sizing, naming, thresholds) live in lib/report-image-capture.ts and
 * are unit-tested there.
 *
 * A side effect worth knowing about: both paths re-encode through a canvas,
 * which drops EXIF metadata. An uploaded phone photo therefore arrives without
 * the camera's embedded GPS coordinates, which is a privacy improvement over
 * shipping the original bytes.
 */

function encodeCanvas(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), REPORT_CAPTURE_MIME_TYPE, REPORT_CAPTURE_JPEG_QUALITY);
  });
}

function drawToCanvas(
  source: CanvasImageSource,
  width: number,
  height: number,
): HTMLCanvasElement | null {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    return null;
  }

  context.drawImage(source, 0, 0, width, height);
  return canvas;
}

/**
 * Grab the current video frame as an upload-ready JPEG File.
 * Returns null when the stream has not produced a sized frame yet.
 */
export async function captureVideoFrameToFile(
  video: HTMLVideoElement,
  now: Date,
): Promise<File | null> {
  const { width, height } = getCaptureDimensions(video.videoWidth, video.videoHeight);

  if (width === 0 || height === 0) {
    return null;
  }

  const canvas = drawToCanvas(video, width, height);

  if (!canvas) {
    return null;
  }

  const blob = await encodeCanvas(canvas);

  if (!blob) {
    return null;
  }

  return new File([blob], buildCaptureFileName(now), {
    type: REPORT_CAPTURE_MIME_TYPE,
  });
}

/**
 * Shrink an oversized upload before it crosses the network.
 *
 * Deliberately forgiving: if the image is already small, or anything at all
 * goes wrong decoding or re-encoding it, the original File is returned
 * untouched. A failed optimisation must never cost someone their report.
 */
export async function downscaleImageFile(file: File): Promise<File> {
  if (typeof createImageBitmap !== "function") {
    return file;
  }

  let bitmap: ImageBitmap | null = null;

  try {
    bitmap = await createImageBitmap(file);

    if (
      !shouldDownscaleImage({
        sizeBytes: file.size,
        width: bitmap.width,
        height: bitmap.height,
      })
    ) {
      return file;
    }

    const { width, height } = getCaptureDimensions(bitmap.width, bitmap.height);

    if (width === 0 || height === 0) {
      return file;
    }

    const canvas = drawToCanvas(bitmap, width, height);

    if (!canvas) {
      return file;
    }

    const blob = await encodeCanvas(canvas);

    if (!blob || blob.size >= file.size) {
      // Re-encoding an already-efficient image can make it bigger.
      return file;
    }

    const baseName = file.name.replace(/\.[^.]+$/, "") || "flood-photo";

    return new File([blob], `${baseName}.jpg`, { type: REPORT_CAPTURE_MIME_TYPE });
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
}
