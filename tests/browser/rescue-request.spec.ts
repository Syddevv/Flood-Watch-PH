import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page) {
  await page.route("**/api/auth/session", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { user: { id: "test-user", email: "test@example.com", displayName: "Test", role: "user" } } }) }));
  await page.route("**/api/rescue-requests?**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { requests: [], nextCursor: null } }) }));
  await page.goto("/rescue-request");
}

test.describe("Request Rescue page", () => {
  test("renders the form, empty history, and the support aside", async ({
    page,
  }) => {
    await signIn(page);

    await expect(
      page.getByRole("heading", { name: "Request Rescue Assistance" }),
    ).toBeVisible();
    await expect(page.getByTestId("rescue-request-form")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "My Rescue Requests" }),
    ).toBeVisible();
    await expect(page.getByTestId("rescue-request-count")).toHaveText("0 requests");

    // The aside is page-owned, not the shared right info panel.
    await expect(page.getByRole("heading", { name: "While you wait" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Emergency hotlines" }),
    ).toBeVisible();

    await expect(page.getByText("Calumpit Rescue 4")).toHaveCount(0);
  });

  test("the sidebar marks Request Rescue as the active section", async ({ page }) => {
    await page.goto("/rescue-request");

    // The nav button labeled "Request Rescue" is rendered on every dashboard
    // page regardless of which section is active, so it can't prove routing
    // worked. The "Current section" panel's label, however, is only ever the
    // active item's label - target that sibling div specifically, not the
    // always-present nav button of the same name.
    const currentSectionLabel = page
      .locator("aside")
      .getByText("Current section", { exact: true })
      .locator("xpath=following-sibling::div[1]");

    await expect(currentSectionLabel).toBeVisible();
    await expect(currentSectionLabel).toHaveText("Request Rescue");
  });

  test("the people stepper clamps at one and counts up", async ({ page }) => {
    await signIn(page);

    const count = page.getByTestId("rescue-people-count");
    await expect(count).toHaveText("1");

    await page.getByTestId("rescue-people-decrement").click();
    await expect(count).toHaveText("1");

    await page.getByTestId("rescue-people-increment").click();
    await page.getByTestId("rescue-people-increment").click();
    await expect(count).toHaveText("3");
    await expect(page.getByText("3 people")).toBeVisible();
  });

  test("None and the real assistance needs are mutually exclusive", async ({
    page,
  }) => {
    await signIn(page);

    const children = page.getByTestId("rescue-assistance-children");
    const none = page.getByTestId("rescue-assistance-none");

    await children.click();
    await expect(children).toHaveAttribute("aria-pressed", "true");

    await none.click();
    await expect(none).toHaveAttribute("aria-pressed", "true");
    await expect(children).toHaveAttribute("aria-pressed", "false");

    await children.click();
    await expect(children).toHaveAttribute("aria-pressed", "true");
    await expect(none).toHaveAttribute("aria-pressed", "false");
  });

  test("anonymous visitors see sign-in choices, not the request form", async ({
    page,
  }) => {
    await page.goto("/rescue-request");

    await expect(page.getByTestId("rescue-signin-notice")).toBeVisible();
    await expect(page.getByTestId("rescue-request-form")).toHaveCount(0);
    const signInPrompt = page.getByTestId("rescue-signin-notice");
    await expect(signInPrompt.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login?next=/rescue-request");
    await expect(signInPrompt.getByRole("link", { name: "Create account" })).toHaveAttribute("href", "/register?next=/rescue-request");
  });

  test("GPS fills the locality and barangay when reverse geocoding identifies them", async ({ page }) => {
    await page.context().grantPermissions(["geolocation"]);
    await page.context().setGeolocation({ latitude: 14.858, longitude: 120.857 });
    await page.route("**/api/reports/reverse-geocode?**", (route) => route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ data: {
        locationName: "Bulihan Road, Bulihan, Plaridel, Bulacan",
        formattedAddress: "Bulihan Road, Bulihan, Plaridel, Bulacan",
        localityCode: "0301417000", barangay: "Bulihan",
      } }),
    }));
    await signIn(page);
    await page.getByTestId("rescue-locality").selectOption("0301407000");
    await page.getByTestId("rescue-barangay").fill("Old barangay");
    await page.getByTestId("rescue-use-current-location").click();
    await expect(page.getByTestId("rescue-location-name")).toHaveValue("Bulihan Road, Bulihan, Plaridel, Bulacan");
    await expect(page.getByTestId("rescue-locality")).toHaveValue("0301417000");
    await expect(page.getByTestId("rescue-barangay")).toHaveValue("Bulihan");
  });

  test("manual location is allowed but contact is required", async ({
    page,
  }) => {
    await signIn(page);

    await expect(page.getByTestId("rescue-signin-notice")).toHaveCount(0);
    await expect(page.getByTestId("rescue-submit")).toBeEnabled();

    await page.getByTestId("rescue-location-name").fill("Brgy. Meysulao");
    await page.getByTestId("rescue-locality").selectOption("0301407000");
    await page.getByTestId("rescue-barangay").fill("Meysulao");
    await page
      .getByTestId("rescue-situation")
      .fill("Water is chest deep and still rising outside.");
    await page.getByTestId("rescue-submit").click();

    await expect(page.getByTestId("rescue-form-error")).toContainText(
      "contact number",
    );
  });

  test("a failed submission keeps inputs and retries with one idempotency key", async ({ page }) => {
    await signIn(page);
    await expect(page.getByTestId("rescue-submit")).toBeEnabled();
    const keys: string[] = [];
    await page.route("**/api/rescue-requests", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      keys.push(route.request().headers()["idempotency-key"]);
      if (keys.length === 1) return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Temporarily unavailable" }) });
      return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ data: { request: { id: "test-request", reference: "RR-TEST123", status: "received", priority: "routine", version: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), forWhom: "self", primaryContact: "09171234567", alternateContact: null, peopleCount: 1, vulnerabilityTags: [], description: "Water is rising quickly", locationName: "Meysulao", locationUncertainty: "manual", localityCode: "0301407000", barangay: "Meysulao", linkedReportId: null }, replayed: false, nearDuplicate: false } }) });
    });
    await page.getByTestId("rescue-location-name").fill("Meysulao");
    await page.getByTestId("rescue-locality").selectOption("0301407000");
    await page.getByTestId("rescue-barangay").fill("Meysulao");
    await page.getByTestId("rescue-situation").fill("Water is rising quickly");
    await page.getByTestId("rescue-contact").fill("09171234567");
    await expect(page.getByTestId("rescue-location-name")).toHaveValue("Meysulao");
    await page.getByTestId("rescue-submit").click();
    await expect(page.getByTestId("rescue-form-error")).toContainText("Temporarily unavailable");
    await expect(page.getByTestId("rescue-location-name")).toHaveValue("Meysulao");
    await page.getByTestId("rescue-submit").click();
    await expect(page.getByTestId("rescue-success")).toContainText("not that a team was dispatched");
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  test("shows persisted event times and stops claiming dispatch for an assigned coordinator", async ({ page }) => {
    await page.route("**/api/auth/session", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { user: { id: "test-user", email: "test@example.com", displayName: "Test", role: "user" } } }) }));
    await page.route("**/api/rescue-requests/test-request", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { id: "test-request", reference: "RR-TEST123", status: "assigned", priority: "urgent", version: 3, createdAt: "2026-10-18T03:00:00.000Z", updatedAt: "2026-10-18T03:05:00.000Z", forWhom: "self", primaryContact: "09171234567", alternateContact: null, peopleCount: 1, vulnerabilityTags: [], description: "Water is rising quickly", locationName: "Meysulao", locationUncertainty: "manual", localityCode: "0301407000", barangay: "Meysulao", linkedReportId: null, events: [{ id: "e1", eventType: "received", nextStatus: "received", createdAt: "2026-10-18T03:00:00.000Z", note: "Request received. Dispatch is not yet confirmed." }, { id: "e2", eventType: "assign", nextStatus: "assigned", createdAt: "2026-10-18T03:05:00.000Z", note: null }] } }) }));
    await page.goto("/rescue-request/test-request");
    await expect(page.getByRole("heading", { name: "Coordinator assigned" })).toBeVisible();
    await expect(page.getByText("A request receipt does not confirm that a team has been dispatched.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Updates" })).toBeVisible();
    await expect(page.getByText("Request received", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Request cancellation" })).toBeVisible();
  });

  test("the layout has no horizontal overflow on a phone viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page);

    await expect(page.getByTestId("rescue-request-form")).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
