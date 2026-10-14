import { expect, test, type Page } from "@playwright/test";

// Marikina is outside the Bulacan polygon.
const OUTSIDE_BULACAN = { latitude: 14.6507, longitude: 121.1029 };
// Malolos is inside the Bulacan polygon.
const MALOLOS = { latitude: 14.8515, longitude: 120.8162 };

async function signIn(page: Page) {
  await page.goto("/incident-reports");
  const origin = new URL(page.url()).origin;
  const response = await page.request.post("/api/auth/register", {
    headers: { Origin: origin, "Content-Type": "application/json" },
    data: JSON.stringify({
      email: `bulacan-scope-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`,
      password: "correct-horse-battery",
    }),
  });
  expect(response.status()).toBe(201);
  await page.reload();
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
    await expect(page.getByTestId("submit-report")).toBeEnabled();
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

  test("a GPS fix outside Bulacan is rejected and hands off to the map picker", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ ...OUTSIDE_BULACAN, accuracy: 30 });
    await signIn(page);

    await page.getByTestId("use-current-location").click();

    await expect(page.getByText(/appears to be outside Bulacan/i)).toBeVisible();
    await expect(
      page.getByRole("dialog", { name: /pick flood location on the map/i }),
    ).toBeVisible();
    // The out-of-area fix must not have been written into the form.
    await expect(page.getByPlaceholder("14.915000")).toHaveValue("");
  });
});
