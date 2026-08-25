import { expect, test } from "@playwright/test";

test.describe("evacuation center coverage scope", () => {
  test("list page shows nearby centers by default and reveals far ones behind a toggle", async ({
    page,
  }) => {
    await page.goto("/evacuation-centers");

    await expect(page.locator("#evacuation-center-calumpit-municipal-gymnasium-reference")).toBeVisible();
    await expect(page.locator("#evacuation-center-marikina-sports-complex")).toHaveCount(0);
    await expect(page.getByText(/within 25 km of Calumpit, Bulacan/i)).toBeVisible();

    const toggle = page.getByTestId("show-all-centers");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");

    const marikina = page.locator("#evacuation-center-marikina-sports-complex");
    await expect(marikina).toBeVisible();
    await expect(marikina.getByTestId("outside-coverage-badge")).toBeVisible();
    await expect(
      page
        .locator("#evacuation-center-calumpit-municipal-gymnasium-reference")
        .getByTestId("outside-coverage-badge"),
    ).toHaveCount(0);
  });

  test("the map API only serves centers within the coverage radius", async ({ page }) => {
    const response = await page.request.get("/api/map/all");
    expect(response.ok()).toBeTruthy();
    const payload = (await response.json()) as {
      meta: { evacuationCenterCount: number; evacuationCenterRadiusKm: number };
      evacuationCenters: Array<{ id: string; province: string }>;
    };

    expect(payload.meta.evacuationCenterCount).toBe(8);
    expect(payload.meta.evacuationCenterRadiusKm).toBe(25);
    expect(payload.evacuationCenters.every((center) => center.province === "Bulacan")).toBe(true);
    expect(payload.evacuationCenters.some((center) => center.id === "marikina-sports-complex")).toBe(false);
  });

  test("the flood map reports the nearby center count and distinguishes shelters from reports", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/flood-map");
    await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible({ timeout: 20_000 });

    await expect(page.getByText(/8 centers visible/i).first()).toBeVisible();
    await expect(page.getByTestId("coverage-chip")).toContainText("Shelters: within 25 km");
    await expect(page.getByText("Evacuation centers (colour = status)").first()).toBeVisible();
  });
});
