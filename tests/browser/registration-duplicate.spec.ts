import { expect, test } from "@playwright/test";

test("registration explains invalid fields and clears errors after correction", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Full Name").fill("Juan123 Cruz");
  await page.getByLabel("Email").click();
  await expect(page.locator("#fullName-error")).toContainText("given name and family name");
  await expect(page.getByLabel("Full Name")).toHaveAttribute("aria-invalid", "true");

  await page.getByLabel("Full Name").fill("Juan Dela Cruz");
  await expect(page.locator("#fullName-error")).toHaveCount(0);
  await page.getByLabel("Email").fill("invalid");
  await page.getByLabel("Password").first().click();
  await expect(page.locator("#email-error")).toContainText("valid email address");

  await page.getByLabel("Password").first().fill("allletterslong");
  await page.getByLabel("Confirm Password").click();
  await expect(page.locator("#password-error")).toContainText("number or symbol");
});

test("duplicate registration shows an error instead of claiming a code was sent", async ({ page }) => {
  await page.context().grantPermissions(["geolocation"]);
  await page.context().setGeolocation({ latitude: 14.91517, longitude: 120.76621 });
  await page.route("**/api/auth/verify-location", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ data: { token: "a".repeat(64), fullAddress: "Malolos, Bulacan, Philippines",
      streetAddress: null, barangay: null, cityMunicipality: "Malolos", postalCode: null } }),
  }));
  await page.route("**/api/auth/register", (route) =>
    route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ error: "This email is already registered. Log in or use a different email." }),
    }),
  );

  await page.goto("/register");
  await page.getByLabel("Full Name").fill("Test Resident");
  await page.getByLabel("Email").fill("existing@example.com");
  await page.getByRole("textbox", { name: "Password", exact: true }).fill("a-valid-test-password1");
  await page.getByLabel("Confirm Password").fill("a-valid-test-password1");
  await page.getByRole("button", { name: "Detect My Location" }).click();
  await expect(page.getByRole("status")).toContainText("Location verified");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "Unable to create your account" })).toContainText("already registered");
  await expect(page).toHaveURL(/\/register$/);
});

test("outside Bulacan keeps registration disabled and offers public access", async ({ page }) => {
  await page.context().grantPermissions(["geolocation"]);
  await page.context().setGeolocation({ latitude: 14.5995, longitude: 120.9842 });
  await page.route("**/api/auth/verify-location", (route) => route.fulfill({
    status: 403, contentType: "application/json",
    body: JSON.stringify({ error: "Registration is currently available only to residents registering from within Bulacan." }),
  }));
  await page.goto("/register");
  await page.getByLabel("Email").fill("guest@example.com");
  await page.getByRole("button", { name: "Detect My Location" }).click();
  await expect(page.getByRole("status")).toContainText("only within Bulacan");
  await expect(page.getByRole("button", { name: "Create account" })).toBeDisabled();
  await expect(page.getByRole("link", { name: "Continue browsing" })).toHaveAttribute("href", "/");
});
