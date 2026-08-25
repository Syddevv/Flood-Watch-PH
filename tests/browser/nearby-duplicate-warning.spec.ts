import { expect, test } from "@playwright/test";

// Inside Calumpit, Bulacan (Poblacion). Report submission is geofenced.
const SEED_LATITUDE = 14.916;
const SEED_LONGITUDE = 120.766;

test.describe("nearby duplicate warning", () => {
  test("stays visible instead of flickering away when a nearby active report exists", async ({
    page,
  }) => {
    await page.goto("/incident-reports");
    const origin = new URL(page.url()).origin;

    // Report creation requires a real account (Priority 1). page.request
    // shares the browser context's cookie jar, so registering here signs
    // the page in too.
    const registerResponse = await page.request.post("/api/auth/register", {
      headers: { Origin: origin, "Content-Type": "application/json" },
      data: JSON.stringify({
        email: `nearby-dup-${Date.now()}@example.com`,
        password: "correct-horse-battery",
      }),
    });
    expect(registerResponse.status()).toBe(201);

    const seedResponse = await page.request.post("/api/reports", {
      headers: { Origin: origin },
      multipart: {
        title: "Bug repro seed report",
        description: "Seed report used to trigger the nearby-duplicate warning.",
        category: "Flooding",
        severity: "Moderate",
        locationName: "Poblacion, Calumpit",
        latitude: String(SEED_LATITUDE),
        longitude: String(SEED_LONGITUDE),
      },
    });
    expect(seedResponse.ok()).toBeTruthy();
    const seedPayload = (await seedResponse.json()) as { data: { id: string } };
    const seedReportId = seedPayload.data.id;

    try {
      await page.reload();
      await page
        .getByPlaceholder("Street, barangay, city")
        .fill("Bug Repro Nearby Spot");
      await page.getByPlaceholder("14.915000").fill(String(SEED_LATITUDE + 0.0003));
      await page.getByPlaceholder("120.766000").fill(String(SEED_LONGITUDE + 0.0003));
      await page
        .getByPlaceholder(/Describe the situation/i)
        .fill("Testing the nearby duplicate warning flow.");

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
      await page.request
        .delete(`/api/reports/${seedReportId}`, { headers: { Origin: origin } })
        .catch(() => undefined);
    }
  });
});
