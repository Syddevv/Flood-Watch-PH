import { expect, test, type Page } from "@playwright/test";
import { registerVerifiedTestUser } from "./verified-test-user";

// Marikina is outside the Bulacan polygon.
const OUTSIDE_BULACAN = { latitude: 14.6507, longitude: 121.1029 };
// Malolos is inside the Bulacan polygon.
const MALOLOS = { latitude: 14.8515, longitude: 120.8162 };

async function signIn(page: Page) {
  await registerVerifiedTestUser(page, "bulacan-scope");
  await expect(page.getByPlaceholder("Street, barangay, city")).toBeVisible();
}

test.describe("Bulacan reporting scope", () => {
  test("manual coordinates outside Bulacan block submission with a clear message", async ({
    page,
  }) => {
    await signIn(page);

    await page.getByPlaceholder("Street, barangay, city").fill("Malolos Sports Center");
    await page.getByPlaceholder(/Describe the situation/i).fill("Testing the geofence.");
    await page.getByPlaceholder("14.915000").fill(String(OUTSIDE_BULACAN.latitude));
    await page.getByPlaceholder("120.766000").fill(String(OUTSIDE_BULACAN.longitude));

    await expect(page.getByTestId("coordinates-outside-area")).toBeVisible();
    await expect(page.getByTestId("submit-report")).toBeDisabled();
    await expect(page.getByText("Location must be within Bulacan.")).toBeVisible();

    await page.getByPlaceholder("14.915000").fill(String(MALOLOS.latitude));
    await page.getByPlaceholder("120.766000").fill(String(MALOLOS.longitude));

    await expect(page.getByTestId("coordinates-outside-area")).not.toBeVisible();
    // In-scope coordinates clear the geography error, but onsite camera/GPS
    // evidence is still required before submission.
    await expect(page.getByTestId("submit-report")).toBeDisabled();
  });

  test("the map picker renders the Bulacan outline on desktop and mobile", async ({
    page,
  }) => {
    await signIn(page);
    await page.getByTestId("pick-location-on-map").click();

    const dialog = page.getByRole("dialog", { name: /pick flood location on the map/i });
    await expect(dialog).toBeVisible();
    const map = dialog.locator(".leaflet-container");
    await expect(map).toBeVisible();
    await expect(map.locator(".leaflet-overlay-pane path").first()).toBeVisible({ timeout: 15_000 });

    await expect(map.locator(".leaflet-overlay-pane path").first()).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(map).toBeVisible();
  });

  test("a GPS fix outside Bulacan is rejected and the map picker remains available", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ ...OUTSIDE_BULACAN, accuracy: 30 });
    await signIn(page);

    await page.getByTestId("use-current-location").click();

    await expect(page.getByText(/appears to be outside Bulacan/i)).toBeVisible();
    // The invalid fix must not populate the form or open the picker for the user.
    await expect(page.getByPlaceholder("14.915000")).toHaveValue("");
    await page.getByTestId("pick-location-on-map").click();
    await expect(
      page.getByRole("dialog", { name: /pick flood location on the map/i }),
    ).toBeVisible();
  });
});
