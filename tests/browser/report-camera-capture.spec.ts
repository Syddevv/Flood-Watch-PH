import { expect, test, type Page } from "@playwright/test";

// Chromium's fake media device is enabled for every project in
// playwright.config.ts, so getUserMedia resolves without a real camera.

// The report form is replaced by a sign-in prompt once the auth session
// resolves to signed-out, so every spec that lingers on the form must
// authenticate first. Same helper shape as calumpit-picker-scope.spec.ts.
async function signIn(page: Page) {
  await page.goto("/incident-reports");
  const origin = new URL(page.url()).origin;
  const response = await page.request.post("/api/auth/register", {
    headers: { Origin: origin, "Content-Type": "application/json" },
    data: JSON.stringify({
      email: `camera-capture-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`,
      password: "correct-horse-battery",
    }),
  });
  expect(response.status()).toBe(201);
  await page.reload();
  await expect(page.getByTestId("submit-report")).toBeVisible();
}

test.describe("in-browser photo capture", () => {
  test("capture, retake, use, and remove a photo without leaving the form", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["camera"]);
    await signIn(page);

    await page.getByTestId("capture-report-image").click();

    const modal = page.getByTestId("report-camera-modal");
    await expect(modal).toBeVisible();
    await expect(page.getByRole("dialog", { name: /take a photo/i })).toBeVisible();

    // The shutter only enables once the video reports real frame dimensions.
    const shutter = page.getByTestId("camera-shutter");
    await expect(shutter).toBeEnabled({ timeout: 15_000 });
    await shutter.click();

    await expect(page.getByTestId("camera-captured-preview")).toBeVisible();

    // Retake discards the still and returns to the live stream.
    await page.getByTestId("camera-retake").click();
    await expect(page.getByTestId("camera-captured-preview")).toHaveCount(0);
    await expect(shutter).toBeEnabled();

    await shutter.click();
    await expect(page.getByTestId("camera-captured-preview")).toBeVisible();
    await page.getByTestId("camera-use-photo").click();

    // The modal closes and the capture is attached to the form.
    await expect(modal).toHaveCount(0);
    await expect(page.getByTestId("report-image-preview")).toBeVisible();
    await expect(page.getByText(/Captured photo/i)).toBeVisible();
    await expect(page.getByText(/flood-capture-\d{8}-\d{6}\.jpg/)).toBeVisible();

    // A user who changes their mind can drop the photo entirely.
    await page.getByTestId("remove-report-image").click();
    await expect(page.getByTestId("report-image-preview")).toHaveCount(0);
  });

  test("closing the camera with Escape leaves the form untouched", async ({ page, context }) => {
    await context.grantPermissions(["camera"]);
    await signIn(page);

    await page.getByTestId("capture-report-image").click();
    await expect(page.getByTestId("report-camera-modal")).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(page.getByTestId("report-camera-modal")).toHaveCount(0);
    await expect(page.getByTestId("report-image-preview")).toHaveCount(0);
  });

  test("a blocked camera explains itself and still offers the upload path", async ({ page }) => {
    // Override getUserMedia before any app code runs. The fake device would
    // otherwise succeed, so denial has to be injected rather than configured.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          getUserMedia: () => {
            const error = new Error("Permission denied");
            error.name = "NotAllowedError";
            return Promise.reject(error);
          },
        },
      });
    });

    await signIn(page);
    await page.getByTestId("capture-report-image").click();

    await expect(page.getByTestId("camera-error")).toContainText(/permission/i);

    // The camera is an addition to the file picker, never a gate in front of it.
    await page.getByTestId("camera-upload-instead").click();
    await expect(page.getByTestId("report-camera-modal")).toHaveCount(0);
    await expect(page.getByTestId("choose-report-image")).toBeVisible();
  });

  test("uploading is unaffected by the capture controls", async ({ page }) => {
    await signIn(page);

    // Still exactly one file input, so the report-flows locator stays valid.
    await expect(page.locator('input[type="file"]')).toHaveCount(1);

    await page.locator('input[type="file"]').setInputFiles({
      name: "invalid.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from("not an accepted image"),
    });

    // Scoped to the toast: the dropzone copy also names the accepted formats.
    await expect(page.getByText(/Upload a JPG, PNG, or WEBP image only/i)).toBeVisible();
    await expect(page.getByTestId("report-image-preview")).toHaveCount(0);
  });
});
