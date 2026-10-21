import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";
import { registerVerifiedTestUser } from "./verified-test-user";

// Inside Calumpit, Bulacan (Poblacion). Report submission is geofenced.
const SEED_LATITUDE = 14.916;
const SEED_LONGITUDE = 120.766;

test.describe("nearby duplicate warning", () => {
  test("stays visible instead of flickering away when a nearby active report exists", async ({ page, context }) => {
    if (!process.env.TEST_DATABASE_URL || process.env.TEST_DATABASE_URL !== process.env.DATABASE_URL) {
      throw new Error("Nearby report fixtures require an isolated TEST_DATABASE_URL matching DATABASE_URL.");
    }
    const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL! }) });
    const incidentId = randomUUID();
    const seedReportId = randomUUID();

    try {
      await db.incident.create({ data: { id: incidentId, representativeLatitude: SEED_LATITUDE, representativeLongitude: SEED_LONGITUDE, locationName: "Poblacion, Calumpit", severity: "Moderate" } });
      await db.floodReport.create({ data: { id: seedReportId, incidentId, title: "Nearby warning seed", description: "Seed report used to trigger the nearby-duplicate warning.", category: "Flooding", severity: "Moderate", locationName: "Poblacion, Calumpit", latitude: SEED_LATITUDE, longitude: SEED_LONGITUDE } });

      await context.grantPermissions(["geolocation", "camera"]);
      await context.setGeolocation({ latitude: SEED_LATITUDE + 0.0003, longitude: SEED_LONGITUDE + 0.0003, accuracy: 10 });
      await registerVerifiedTestUser(page, "nearby-dup");
      await page.getByTestId("use-current-location").click();
      await expect(page.getByPlaceholder("14.915000")).toHaveValue(String(SEED_LATITUDE + 0.0003));
      await page.getByPlaceholder("Street, barangay, city").fill("Bug Repro Nearby Spot");
      await page.getByPlaceholder(/Describe the situation/i).fill("Testing the nearby duplicate warning flow.");
      await page.getByTestId("capture-report-image").click();
      await page.getByTestId("camera-shutter").click();
      await page.getByTestId("camera-use-photo").click();
      await expect(page.getByTestId("submit-report")).toBeEnabled();

      await page.getByTestId("submit-report").click();

      const warningHeading = page.getByText(/Nearby active report found within/i);
      const continueButton = page.getByRole("button", {
        name: /Continue submitting new report/i,
      });

      // Root-cause regression guard: the warning previously cleared itself
      // one animation frame after appearing, because the effect that resets
      // pendingNearbyDuplicate on form edits also listed pendingNearbyDuplicate
      // itself as a dependency, causing it to immediately re-fire and null
      // itself out. Assert it is still visible after a delay, not just that
      // it appeared at some point.
      await expect(warningHeading).toBeVisible();
      await page.waitForTimeout(500);
      await expect(warningHeading).toBeVisible();
      await expect(continueButton).toBeVisible();

      // The user must still be able to explicitly submit a separate report.
      await continueButton.click();
      await expect(warningHeading).not.toBeVisible();
    } finally {
      await db.floodReport.deleteMany({ where: { id: seedReportId } });
      await db.incident.deleteMany({ where: { id: incidentId } });
      await db.$disconnect();
    }
  });
});
