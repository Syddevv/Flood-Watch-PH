import { expect, test } from "@playwright/test";

/**
 * Regression: a report popup used to close itself about a second after
 * opening, but only for pins close enough to share a cluster.
 *
 * Clicking a marker flew the map to a fixed zoom. When the user had already
 * zoomed in to separate two nearby pins, that fixed zoom was a zoom *out*, so
 * leaflet.markercluster re-clustered them on zoomend, detached the clicked
 * marker from the map, and took its popup with it.
 */
test.describe("report marker popup", () => {
  test("stays open after the fly-to settles, including for clustered pins", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/flood-map");
    await page.locator(".leaflet-tile-loaded").first().waitFor({ timeout: 20_000 });
    await page.waitForTimeout(3000);

    // Drill into a cluster so its members are individually clickable - this is
    // the state the bug needed, because the pins are only ~40 m apart.
    const cluster = page.locator(".marker-cluster").first();

    if (await cluster.count()) {
      await cluster.click({ force: true });
      await page.waitForTimeout(3000);
    }

    const reportMarker = page
      .locator(".leaflet-marker-icon")
      .filter({ hasText: "R" })
      .first();

    await expect(reportMarker).toBeVisible();
    await reportMarker.click({ force: true });

    const popup = page.locator(".leaflet-popup");
    await expect(popup).toBeVisible();

    // The fly-to runs for ~0.9 s and clustering settles on zoomend, which is
    // when the popup used to disappear. Wait past both, then re-assert.
    await page.waitForTimeout(2500);
    await expect(popup).toBeVisible();
  });
});
