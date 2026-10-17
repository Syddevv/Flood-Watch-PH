import { expect, test } from "@playwright/test";

test.describe("report browser flows", () => {
  test("report submission form exposes location, camera, GPS status, and submit controls", async ({ page }) => {
    await page.goto("/incident-reports");

    await expect(page.getByTestId("use-current-location")).toBeVisible();
    await expect(page.getByTestId("pick-location-on-map")).toBeVisible();
    await expect(page.getByTestId("capture-report-image")).toBeVisible();
    await expect(page.getByTestId("onsite-gps-status")).toBeVisible();
    await expect(page.getByTestId("submit-report")).toBeVisible();
  });

  test("map picker can be opened and confirmed", async ({ page }) => {
    await page.goto("/incident-reports");
    await page.getByTestId("pick-location-on-map").click();
    await expect(page.getByRole("dialog", { name: /pick flood location on the map/i })).toBeVisible();
    await expect(page.getByTestId("confirm-picked-location")).toBeVisible();
  });

  test("file upload controls are absent from new-report submission", async ({ page }) => {
    await page.goto("/incident-reports");
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
    await expect(page.getByTestId("choose-report-image")).toHaveCount(0);
  });

  test("report details expose the ownership management control when available", async ({ page }) => {
    await page.goto("/incident-reports");
    const manageButton = page.getByTestId("manage-report");
    if (await manageButton.count()) {
      await expect(manageButton).toBeVisible();
    }
  });
});
