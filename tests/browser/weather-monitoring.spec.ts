import { expect, test } from "@playwright/test";

const OUTSIDE_BULACAN = { latitude: 14.6091, longitude: 121.0223 };

test("partial overview keeps a Bulacan locality and identifies missing points", async ({ page }) => {
  await page.route("**/api/weather/overview", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: {
        locations: [{
          name: "Hagonoy",
          latitude: 14.8355035,
          longitude: 120.7335206,
          temperature: 29,
          precipitation: 0,
          humidity: 78,
          windSpeed: 5,
          condition: "Partly cloudy",
          riskLevel: "Low",
          updatedAt: "Oct 14, 2026, 5:00 PM",
          source: { category: "provider", name: "Open-Meteo" },
          officialReference: { category: "official", name: "PAGASA" },
          disclaimer: "Model estimate. Check official advisories separately.",
        }],
        alerts: [],
        fetchedAt: "Oct 14, 2026, 5:01 PM",
        advisoryMessage: "Model estimate. Check official advisories separately.",
        monitoredLocationCount: 10,
        unavailableLocations: ["Calumpit"],
      } }),
    });
  });

  const overviewResponse = page.waitForResponse("**/api/weather/overview");
  await page.goto("/weather-monitoring");
  await overviewResponse;
  await expect(page.getByRole("heading", { name: "Monitored Bulacan localities" })).toBeVisible();
  await expect(page.getByText(/Forecast unavailable for Calumpit/)).toBeVisible();
  await expect(page.getByText(/No live official bulletin is loaded/)).toBeVisible();
  await expect(page.getByText("Hagonoy", { exact: true })).toBeVisible();
  await expect(page.getByText(/Metro Manila, Marikina/)).toHaveCount(0);
});

test("current location outside Bulacan gives a scope message", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ ...OUTSIDE_BULACAN, accuracy: 30 });
  await page.route("**/api/weather/coordinates?**", async (route) => {
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ error: "This location is outside Bulacan. Weather monitoring covers Bulacan only." }),
    });
  });
  const overviewResponse = page.waitForResponse("**/api/weather/overview");
  await page.goto("/weather-monitoring");
  await overviewResponse;
  await page.getByRole("button", { name: "Use my location" }).click();
  await expect(page.getByText("This location is outside Bulacan. Weather monitoring covers Bulacan only.")).toBeVisible();
});
