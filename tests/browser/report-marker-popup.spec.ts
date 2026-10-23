import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
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
  for (const [scenario, coordinateOffset, mobile] of [
    ["nearby pins", 0.0003, false],
    ["same-coordinate pins", 0, false],
    ["same-coordinate pins on mobile", 0, true],
  ] as const) {
  test(`stays open after selecting ${scenario}`, async ({ page }) => {
    if (!process.env.TEST_DATABASE_URL || process.env.TEST_DATABASE_URL !== process.env.DATABASE_URL) {
      throw new Error("Map marker fixtures require an isolated TEST_DATABASE_URL matching DATABASE_URL.");
    }
    const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL }) });
    const incidentIds = [randomUUID(), randomUUID()];
    const reportIds = [randomUUID(), randomUUID()];
    try {
      for (const [index, incidentId] of incidentIds.entries()) {
        const latitude = 14.916 + index * coordinateOffset;
        const longitude = 120.766 + index * coordinateOffset;
        await db.incident.create({ data: { id: incidentId, representativeLatitude: latitude, representativeLongitude: longitude, locationName: `Popup fixture ${index}`, severity: "Moderate" } });
        await db.floodReport.create({ data: { id: reportIds[index], incidentId, title: `Popup fixture ${index}`, description: "Map popup regression fixture", category: "Flooding", severity: "Moderate", locationName: `Popup fixture ${index}`, latitude, longitude } });
      }

      await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 });
      await page.goto("/flood-map");
      if (!mobile) await page.getByRole("button", { name: "Collapse map layers panel" }).click();
      await expect(page.locator(".marker-cluster").first()).toBeVisible({ timeout: 15_000 });
      const reportMarker = page.locator(".leaflet-marker-icon").filter({ hasText: "R" }).first();
      // Near pins may remain clustered after the first zoom; keep drilling in.
      for (let attempt = 0; attempt < 6 && !(await reportMarker.isVisible()); attempt++) {
        const cluster = page.locator(".marker-cluster").first();
        await expect(cluster).toBeVisible();
        await cluster.click();
        await page.waitForTimeout(1000);
      }
      await expect(reportMarker).toBeVisible();
      await reportMarker.click();

      const popup = page.locator(".leaflet-popup");
      await expect(popup).toBeVisible();
      // A map flight must not collapse spiderfied same-coordinate markers.
      await page.waitForTimeout(2500);
      await expect(popup).toBeVisible();
      if (coordinateOffset === 0) {
        await popup.getByRole("button", { name: "View Details" }).click();
        await expect(page.getByRole("button", { name: "Close report details" })).toBeVisible();
      }
    } finally {
      await db.floodReport.deleteMany({ where: { id: { in: reportIds } } });
      await db.incident.deleteMany({ where: { id: { in: incidentIds } } });
      await db.$disconnect();
    }
  });
  }
});
