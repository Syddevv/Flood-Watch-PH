import { expect, test } from "@playwright/test";

const isolatedDatabase = Boolean(process.env.TEST_DATABASE_URL && process.env.TEST_DATABASE_URL === process.env.DATABASE_URL);

test.describe("Bulacan evacuation center scope", () => {
  test("public list matches the database-backed center API", async ({ page }) => {
    test.skip(!isolatedDatabase, "Requires matching isolated TEST_DATABASE_URL and DATABASE_URL.");
    const response = await page.request.get("/api/evacuation-centers");
    expect(response.ok()).toBeTruthy();
    const payload = await response.json() as { data: { centers: Array<{ id: string; province: string }> } };
    expect(payload.data.centers.every((center) => center.province === "Bulacan")).toBe(true);
    await page.goto("/evacuation-centers");
    await expect(page.getByText(`${payload.data.centers.length} center${payload.data.centers.length === 1 ? "" : "s"} found`)).toBeVisible();
    for (const center of payload.data.centers) await expect(page.locator(`#evacuation-center-${center.id}`)).toBeVisible();
    await expect(page.locator("#evacuation-center-marikina-sports-complex")).toHaveCount(0);
  });

  test("map and center APIs serve the same published center IDs", async ({ page }) => {
    test.skip(!isolatedDatabase, "Requires matching isolated TEST_DATABASE_URL and DATABASE_URL.");
    const response = await page.request.get("/api/map/all");
    expect(response.ok()).toBeTruthy();
    const payload = await response.json() as {
      meta: { evacuationCenterCount: number; scopeVersion: string };
      evacuationCenters: Array<{ id: string; province: string }>;
    };
    const listResponse = await page.request.get("/api/evacuation-centers");
    expect(listResponse.ok()).toBeTruthy();
    const list = await listResponse.json() as { data: { centers: Array<{ id: string }> } };
    expect(payload.meta.evacuationCenterCount).toBe(list.data.centers.length);
    expect(payload.meta.scopeVersion).toBe("osm-1504656-2026-10-14");
    expect(payload.evacuationCenters.every((center) => center.province === "Bulacan")).toBe(true);
    expect(payload.evacuationCenters.map((center) => center.id).sort()).toEqual(list.data.centers.map((center) => center.id).sort());
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
