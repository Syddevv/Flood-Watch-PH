import { expect, test } from "@playwright/test";

test("duplicate registration shows an error instead of claiming a code was sent", async ({ page }) => {
  await page.route("**/api/auth/register", (route) =>
    route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ error: "This email is already registered. Log in or use a different email." }),
    }),
  );

  await page.goto("/register");
  await page.getByLabel("Email").fill("existing@example.com");
  await page.getByRole("textbox", { name: "Password" }).fill("a-valid-test-password");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "Unable to create your account" })).toContainText("already registered");
  await expect(page).toHaveURL(/\/register$/);
});
