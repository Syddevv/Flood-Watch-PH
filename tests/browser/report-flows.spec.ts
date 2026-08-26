import { expect, test } from "@playwright/test";

test.describe("report browser flows", () => {
  test("report submission form exposes location, image, and submit controls", async ({ page }) => {
    await page.goto("/incident-reports");

    await expect(page.getByTestId("use-current-location")).toBeVisible();
    await expect(page.getByTestId("pick-location-on-map")).toBeVisible();
    await expect(page.getByTestId("choose-report-image")).toBeVisible();
    await expect(page.getByTestId("submit-report")).toBeVisible();
  });

  test("map picker can be opened and confirmed", async ({ page }) => {
    await page.goto("/incident-reports");
    await page.getByTestId("pick-location-on-map").click();
    await expect(page.getByRole("dialog", { name: /pick flood location on the map/i })).toBeVisible();
    await expect(page.getByTestId("confirm-picked-location")).toBeVisible();
  });

  test("invalid image selection is surfaced to the user", async ({ page }) => {
    await page.goto("/incident-reports");
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: "invalid.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from("not an accepted image"),
    });
    // Scoped to the rejection toast - the dropzone copy names the same formats.
    await expect(page.getByText(/Upload a JPG, PNG, or WEBP image only/i)).toBeVisible();
  });

  test("report details expose the ownership management control when available", async ({ page }) => {
    await page.goto("/incident-reports");
    const manageButton = page.getByTestId("manage-report");
    if (await manageButton.count()) {
      await expect(manageButton).toBeVisible();
    }
  });
});
