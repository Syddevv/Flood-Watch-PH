import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page) {
  await page.goto("/rescue-request");
  const origin = new URL(page.url()).origin;
  const response = await page.request.post("/api/auth/register", {
    headers: { Origin: origin, "Content-Type": "application/json" },
    data: JSON.stringify({
      email: `rescue-request-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`,
      password: "correct-horse-battery",
    }),
  });
  expect(response.status()).toBe(201);
  await page.reload();
}

test.describe("Request Rescue page", () => {
  test("renders the form, sample requests, and the support aside", async ({
    page,
  }) => {
    await page.goto("/rescue-request");

    await expect(
      page.getByRole("heading", { name: "Request Rescue Assistance" }),
    ).toBeVisible();
    await expect(page.getByTestId("rescue-request-form")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "My Rescue Requests" }),
    ).toBeVisible();
    await expect(page.getByTestId("rescue-request-count")).toHaveText("2 requests");

    // The aside is page-owned, not the shared right info panel.
    await expect(page.getByRole("heading", { name: "While you wait" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Emergency hotlines" }),
    ).toBeVisible();

    // Sample data must stay scoped to Calumpit. The team name legitimately
    // appears twice by design (the card's assigned-team badge, and its own
    // "Team Dispatched" timeline note), so this locator is disambiguated with
    // .first() rather than loosened - it still asserts the text is visible.
    await expect(page.getByText("Calumpit Rescue 4").first()).toBeVisible();
    await expect(page.getByText(/Marikina/i)).toHaveCount(0);
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
    await page.goto("/rescue-request");

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
    await page.goto("/rescue-request");

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

  test("anonymous visitors see the sign-in notice and a disabled submit", async ({
    page,
  }) => {
    await page.goto("/rescue-request");

    await expect(page.getByTestId("rescue-signin-notice")).toBeVisible();
    await expect(page.getByTestId("rescue-submit")).toBeDisabled();
  });

  test("a signed-in visitor submitting an unpinned form gets a clear error", async ({
    page,
  }) => {
    await signIn(page);

    await expect(page.getByTestId("rescue-signin-notice")).toHaveCount(0);
    await expect(page.getByTestId("rescue-submit")).toBeEnabled();

    await page.getByTestId("rescue-location-name").fill("Brgy. Meysulao");
    await page
      .getByTestId("rescue-situation")
      .fill("Water is chest deep and still rising outside.");
    await page.getByTestId("rescue-submit").click();

    await expect(page.getByTestId("rescue-form-error")).toContainText(
      "Pin your location",
    );
  });

  test("the layout has no horizontal overflow on a phone viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/rescue-request");

    await expect(page.getByTestId("rescue-request-form")).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
