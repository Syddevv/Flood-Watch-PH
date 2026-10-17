import assert from "node:assert/strict";
import test from "node:test";

import { uploadReportImageToCloudinary } from "@/lib/cloudinary";

function restoreEnvironmentVariable(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

test("the report image upload stub is restricted to explicitly enabled test runs", async () => {
  const previousEnvironment = {
    stubEnabled: process.env.REPORT_IMAGE_UPLOAD_TEST_STUB,
    databaseUrl: process.env.DATABASE_URL,
    testDatabaseUrl: process.env.TEST_DATABASE_URL,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  };

  try {
    process.env.REPORT_IMAGE_UPLOAD_TEST_STUB = "true";
    process.env.TEST_DATABASE_URL = "postgresql://integration-test-database";
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

    assert.equal(
      await uploadReportImageToCloudinary(Buffer.from("test image"), "onsite report.png"),
      "https://example.invalid/test-report-images/onsite%20report.png",
    );

    process.env.DATABASE_URL = "postgresql://production-database";
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;

    await assert.rejects(
      uploadReportImageToCloudinary(Buffer.from("test image"), "onsite report.png"),
      /Cloudinary is not configured/,
    );
  } finally {
    restoreEnvironmentVariable(
      "REPORT_IMAGE_UPLOAD_TEST_STUB",
      previousEnvironment.stubEnabled,
    );
    restoreEnvironmentVariable("DATABASE_URL", previousEnvironment.databaseUrl);
    restoreEnvironmentVariable("TEST_DATABASE_URL", previousEnvironment.testDatabaseUrl);
    restoreEnvironmentVariable("CLOUDINARY_CLOUD_NAME", previousEnvironment.cloudName);
    restoreEnvironmentVariable("CLOUDINARY_API_KEY", previousEnvironment.apiKey);
    restoreEnvironmentVariable("CLOUDINARY_API_SECRET", previousEnvironment.apiSecret);
  }
});
