import assert from "node:assert/strict";
import test from "node:test";

import { uploadReportImageFile } from "@/lib/report-api";
import {
  REPORT_IMAGE_MAX_BYTES,
  validateReportImageBuffer,
  validateReportImageFile,
} from "@/lib/report-image-validation";

const pngSignature = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

test("image metadata requires a matching extension and MIME type", () => {
  assert.equal(
    validateReportImageFile({ name: "flood.png", type: "image/png", size: 100 }),
    null,
  );
  assert.equal(
    validateReportImageFile({ name: "flood.jpg", type: "image/png", size: 100 }),
    "Upload a JPG, PNG, or WEBP image only.",
  );
  assert.equal(
    validateReportImageFile({ name: "flood.svg", type: "image/svg+xml", size: 100 }),
    "Upload a JPG, PNG, or WEBP image only.",
  );
});

test("image metadata rejects files larger than five megabytes", () => {
  assert.equal(
    validateReportImageFile({
      name: "flood.webp",
      type: "image/webp",
      size: REPORT_IMAGE_MAX_BYTES + 1,
    }),
    "Image must be 5 MB or smaller.",
  );
});

test("image signatures must match the claimed MIME type", () => {
  assert.equal(validateReportImageBuffer(Buffer.from(pngSignature), "image/png"), null);
  assert.equal(
    validateReportImageBuffer(Buffer.from("not an image"), "image/png"),
    "The uploaded file is not a valid JPG, PNG, or WEBP image.",
  );
  assert.equal(
    validateReportImageBuffer(Buffer.from(pngSignature), "image/jpeg"),
    "The uploaded file is not a valid JPG, PNG, or WEBP image.",
  );
});

test("Cloudinary failures do not fall back to Base64 database storage", async (context) => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  delete process.env.CLOUDINARY_CLOUD_NAME;
  delete process.env.CLOUDINARY_API_KEY;
  delete process.env.CLOUDINARY_API_SECRET;
  context.mock.method(console, "error", () => undefined);

  try {
    const file = new File([pngSignature], "flood.png", { type: "image/png" });

    assert.deepEqual(await uploadReportImageFile(file), {
      error:
        "Image storage is temporarily unavailable. Submit the report without an image or try again later.",
      status: 503,
    });
  } finally {
    if (cloudName) process.env.CLOUDINARY_CLOUD_NAME = cloudName;
    if (apiKey) process.env.CLOUDINARY_API_KEY = apiKey;
    if (apiSecret) process.env.CLOUDINARY_API_SECRET = apiSecret;
  }
});
