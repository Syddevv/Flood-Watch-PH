import { expect, test, type Page } from "@playwright/test";

async function fillCode(page: Page, code: string) {
  for (const [index, digit] of [...code].entries()) {
    await page.getByLabel(`Verification digit ${index + 1}`).fill(digit);
  }
}

test("desktop verification accepts a six-digit code and redirects after success", async ({
  page,
}) => {
  await page.route("**/api/auth/verify-code", async (route) => {
    const payload = route.request().postDataJSON() as { email: string; code: string };
    expect(payload).toEqual({ email: "resident@example.com", code: "123456" });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { verified: true } }),
    });
  });
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { user: { email: "resident@example.com" } } }),
    }),
  );

  await page.goto("/verify-email?email=resident%40example.com");
  await expect(page.getByRole("heading", { name: "Verify Your Email" })).toBeVisible();
  await expect(page.getByLabel("Verification digit 1")).toBeFocused();
  await fillCode(page, "123456");
  await expect(page.getByRole("button", { name: "Verify email" })).toBeEnabled();
  await page.getByRole("button", { name: "Verify email" }).click();
  await expect(page).toHaveURL(/\/incident-reports$/);
});

test("mobile verification shows expired-code feedback and resend cooldown", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/auth/verify-code", (route) =>
    route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({
        error: "This code has expired. Request a new code.",
        code: "CODE_EXPIRED",
      }),
    }),
  );
  await page.route("**/api/auth/resend-verification", (route) =>
    route.fulfill({
      status: 202,
      contentType: "application/json",
      body: JSON.stringify({ data: { requested: true, retryAfterSeconds: 60 } }),
    }),
  );

  await page.goto("/verify-email?email=resident%40example.com");
  await fillCode(page, "123456");
  await expect(page.getByRole("button", { name: "Verify email" })).toBeEnabled();
  await page.getByRole("button", { name: "Verify email" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "expired" })).toBeVisible();

  await page.getByRole("button", { name: "Resend verification code" }).click();
  await expect(page.getByRole("button", { name: /Resend code in 60s/ })).toBeDisabled();
  await expect(page.getByRole("status")).toContainText("new code");
});
