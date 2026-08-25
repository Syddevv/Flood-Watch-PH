import { expect, test, type Page } from "@playwright/test";

// Malolos City sports centre - inside the padded map box, outside Calumpit.
const MALOLOS = { latitude: 14.8515, longitude: 120.8162 };
// Poblacion, Calumpit - well inside the municipal polygon.
const CALUMPIT = { latitude: 14.916, longitude: 120.766 };

async function signIn(page: Page) {
  await page.goto("/incident-reports");
  const origin = new URL(page.url()).origin;
  const response = await page.request.post("/api/auth/register", {
    headers: { Origin: origin, "Content-Type": "application/json" },
    data: JSON.stringify({
      email: `calumpit-scope-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`,
      password: "correct-horse-battery",
    }),
  });
  expect(response.status()).toBe(201);
  await page.reload();
  await expect(page.getByPlaceholder("Street, barangay, city")).toBeVisible();
}

test.describe("Calumpit reporting scope", () => {
  test("manual coordinates outside Calumpit block submission with a clear message", async ({
    page,
  }) => {
    await signIn(page);

    await page.getByPlaceholder("Street, barangay, city").fill("Malolos Sports Center");
    await page.getByPlaceholder(/Describe the situation/i).fill("Testing the geofence.");
    await page.getByPlaceholder("14.915000").fill(String(MALOLOS.latitude));
    await page.getByPlaceholder("120.766000").fill(String(MALOLOS.longitude));

    await expect(page.getByTestId("coordinates-outside-area")).toBeVisible();
    await expect(page.getByTestId("submit-report")).toBeDisabled();
    await expect(page.getByText("Location must be within Calumpit, Bulacan.")).toBeVisible();

    await page.getByPlaceholder("14.915000").fill(String(CALUMPIT.latitude));
    await page.getByPlaceholder("120.766000").fill(String(CALUMPIT.longitude));

    await expect(page.getByTestId("coordinates-outside-area")).not.toBeVisible();
    await expect(page.getByTestId("submit-report")).toBeEnabled();
  });

  test("the map picker warns and disables confirm for a pin outside Calumpit", async ({
    page,
  }) => {
    await signIn(page);
    await page.getByTestId("pick-location-on-map").click();

    const dialog = page.getByRole("dialog", { name: /pick flood location on the map/i });
    await expect(dialog).toBeVisible();
    const map = dialog.locator(".leaflet-container");
    await expect(map).toBeVisible();
    await expect(map.locator(".leaflet-tile-loaded").first()).toBeVisible({ timeout: 15_000 });

    const box = await map.boundingBox();
    if (!box) throw new Error("map has no bounding box");

    // The picker opens fitted to Calumpit's bounding box, so the centre of
    // the map is inside the municipality. Click inside FIRST: every
    // selection flies the map to the pin at zoom 14, so the order matters -
    // after an outside click the "centre" would be the outside point.
    await map.click({ position: { x: box.width / 2, y: box.height / 2 } });
    await expect(dialog.getByTestId("picker-outside-area-warning")).not.toBeVisible();
    await expect(dialog.getByTestId("confirm-picked-location")).toBeEnabled({ timeout: 15_000 });

    // A click at the very corner of the map is outside Calumpit whether the
    // fly-to has finished or not: the fitted box's corners are already in a
    // neighbouring municipality, and zoom 14 around the centre reaches even
    // further out.
    await map.click({ position: { x: box.width - 6, y: 6 } });
    await expect(dialog.getByTestId("picker-outside-area-warning")).toBeVisible();
    await expect(dialog.getByTestId("confirm-picked-location")).toBeDisabled();
  });

  test("a GPS fix outside Calumpit is rejected and hands off to the map picker", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ ...MALOLOS, accuracy: 30 });
    await signIn(page);

    await page.getByTestId("use-current-location").click();

    await expect(page.getByText(/appears to be outside Calumpit, Bulacan/i)).toBeVisible();
    await expect(
      page.getByRole("dialog", { name: /pick flood location on the map/i }),
    ).toBeVisible();
    // The out-of-area fix must not have been written into the form.
    await expect(page.getByPlaceholder("14.915000")).toHaveValue("");
  });
});
