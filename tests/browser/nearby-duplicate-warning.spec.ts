import { expect, test } from "@playwright/test";

test.describe("nearby duplicate warning", () => {
  test("stays visible instead of flickering away when a nearby active report exists", async ({
    page,
  }) => {
    await page.goto("/incident-reports");
    const origin = new URL(page.url()).origin;
    await page.request.post("/api/report-session", {
      data: "{}",
      headers: { Origin: origin },
    });
    await page.waitForLoadState("networkidle");

    const latitude = 14.601234;
    const longitude = 120.981234;

    const seedResponse = await page.request.post("/api/reports", {
      headers: { Origin: origin },
      multipart: {
        title: "Bug repro seed report",
        description: "Seed report used to trigger the nearby-duplicate warning.",
        category: "Flooding",
        severity: "Moderate",
        locationName: "Bug Repro Seed Spot",
        latitude: String(latitude),
        longitude: String(longitude),
      },
    });
    expect(seedResponse.ok()).toBeTruthy();
    const seedPayload = (await seedResponse.json()) as { data: { id: string } };
    const seedReportId = seedPayload.data.id;

    try {
      await page
        .getByPlaceholder("Street, barangay, city")
        .fill("Bug Repro Nearby Spot");
      await page.getByPlaceholder("14.599500").fill(String(latitude + 0.0003));
      await page.getByPlaceholder("120.984200").fill(String(longitude + 0.0003));
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
