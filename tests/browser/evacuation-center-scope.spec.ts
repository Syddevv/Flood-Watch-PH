import { expect, test } from "@playwright/test";

test.describe("Bulacan evacuation center scope", () => {
  test("public list shows Bulacan references and excludes outside references", async ({ page }) => {
    await page.goto("/evacuation-centers");
    await expect(page.locator("#evacuation-center-calumpit-municipal-gymnasium-reference")).toBeVisible();
    await expect(page.locator("#evacuation-center-marikina-sports-complex")).toHaveCount(0);
    await expect(page.getByText(/within Bulacan.*verification pending/i)).toBeVisible();
    await expect(page.getByTestId("show-all-centers")).toHaveCount(0);
  });

  test("map API serves in-province references with a scope version", async ({ page }) => {
    const response = await page.request.get("/api/map/all");
    expect(response.ok()).toBeTruthy();
    const payload = await response.json() as {
      meta: { evacuationCenterCount: number; scopeVersion: string };
      evacuationCenters: Array<{ id: string; province: string }>;
    };
    expect(payload.meta.evacuationCenterCount).toBe(13);
    expect(payload.meta.scopeVersion).toBe("osm-1504656-2026-10-14");
    expect(payload.evacuationCenters.every((center) => center.province === "Bulacan")).toBe(true);
    expect(payload.evacuationCenters.some((center) => center.id === "marikina-sports-complex")).toBe(false);
  });

  test("flood map shows the Bulacan reporting area", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/flood-map");
    await expect(page.locator(".leaflet-overlay-pane canvas").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("coverage-chip")).toContainText("Reports: Bulacan");
    await expect(page.getByText("Reporting area: Bulacan").first()).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator(".leaflet-overlay-pane canvas").first()).toBeVisible();
    await expect(page.getByTestId("coverage-chip")).toContainText("Reports: Bulacan");
  });
});
