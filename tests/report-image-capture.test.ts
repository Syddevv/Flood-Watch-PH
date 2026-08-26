import assert from "node:assert/strict";
import test from "node:test";

import {
  CAMERA_UNSUPPORTED_MESSAGE,
  REPORT_CAPTURE_MAX_EDGE_PX,
  REPORT_CAPTURE_MIME_TYPE,
  buildCaptureFileName,
  describeCameraError,
  getCaptureDimensions,
  isCameraCaptureSupported,
  shouldDownscaleImage,
} from "@/lib/report-image-capture";
import { validateReportImageFile } from "@/lib/report-image-validation";

test("capture dimensions shrink the long edge and preserve the aspect ratio", () => {
  assert.deepEqual(getCaptureDimensions(3840, 2160), { width: 1600, height: 900 });
  assert.deepEqual(getCaptureDimensions(2160, 3840), { width: 900, height: 1600 });
  assert.deepEqual(getCaptureDimensions(3000, 3000), { width: 1600, height: 1600 });
});

test("capture dimensions never upscale an already-small frame", () => {
  assert.deepEqual(getCaptureDimensions(640, 480), { width: 640, height: 480 });
  assert.deepEqual(getCaptureDimensions(REPORT_CAPTURE_MAX_EDGE_PX, 900), {
    width: REPORT_CAPTURE_MAX_EDGE_PX,
    height: 900,
  });
});

test("capture dimensions are whole pixels and never collapse to zero", () => {
  const { width, height } = getCaptureDimensions(4001, 3);

  assert.equal(Number.isInteger(width), true);
  assert.equal(Number.isInteger(height), true);
  assert.ok(height >= 1, "a very wide frame must keep at least one pixel of height");
});

test("unusable video dimensions yield no capture size", () => {
  assert.deepEqual(getCaptureDimensions(0, 0), { width: 0, height: 0 });
  assert.deepEqual(getCaptureDimensions(Number.NaN, 480), { width: 0, height: 0 });
  assert.deepEqual(getCaptureDimensions(-100, 480), { width: 0, height: 0 });
});

test("a captured file name is accepted by the shared image validator", () => {
  const name = buildCaptureFileName(new Date("2026-08-26T18:35:00"));

  assert.equal(name, "flood-capture-20260826-183500.jpg");
  // The validator cross-checks extension against MIME type, so a canvas JPEG
  // named .png is rejected at the door. This pins the two together.
  const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], name, {
    type: REPORT_CAPTURE_MIME_TYPE,
  });
  assert.equal(validateReportImageFile(file), null);
});

test("downscaling is skipped for small images and triggered by size or dimensions", () => {
  assert.equal(shouldDownscaleImage({ sizeBytes: 200_000, width: 1024, height: 768 }), false);
  assert.equal(shouldDownscaleImage({ sizeBytes: 4_000_000, width: 1024, height: 768 }), true);
  assert.equal(shouldDownscaleImage({ sizeBytes: 200_000, width: 4032, height: 3024 }), true);
});

test("camera failures map to actionable messages that always mention uploading", () => {
  const cases = [
    "NotAllowedError",
    "SecurityError",
    "NotFoundError",
    "OverconstrainedError",
    "NotReadableError",
    "AbortError",
  ];

  const messages = cases.map((name) => describeCameraError(Object.assign(new Error(name), { name })));

  for (const message of messages) {
    assert.ok(message.length > 0);
  }

  assert.match(messages[0], /permission/i);
  assert.match(messages[2], /camera/i);
  assert.match(messages[4], /another app|in use/i);
  // Distinct failures must not collapse into one vague sentence.
  assert.notEqual(messages[0], messages[2]);
  assert.notEqual(messages[2], messages[4]);
});

test("an unrecognised failure falls back to the unsupported-browser message", () => {
  assert.equal(describeCameraError(new Error("boom")), CAMERA_UNSUPPORTED_MESSAGE);
  assert.equal(describeCameraError(undefined), CAMERA_UNSUPPORTED_MESSAGE);
});

test("camera support requires both mediaDevices and a secure context", () => {
  const withCamera = { mediaDevices: { getUserMedia: () => undefined } };

  assert.equal(isCameraCaptureSupported(withCamera, true), true);
  // getUserMedia is unavailable over plain HTTP, so offering the button lies.
  assert.equal(isCameraCaptureSupported(withCamera, false), false);
  assert.equal(isCameraCaptureSupported({}, true), false);
  assert.equal(isCameraCaptureSupported({ mediaDevices: {} }, true), false);
  assert.equal(isCameraCaptureSupported(undefined, true), false);
});
