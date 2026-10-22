import { expect, test } from "@playwright/test";

for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
  test(`report form uses account identity at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.route("**/api/auth/session", (route) => route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ data: { user: { id: "test-user", email: "private@example.com", displayName: "Test Resident", fullName: "Test Resident", role: "user" } } }) }));
    await page.route("**/api/report-session", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: {} }) }));
    await page.route("**/api/reports?limit=50", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 1 } }) }));
    await page.goto("/incident-reports");
    await expect(page.getByText("Reporter information", { exact: true })).toBeVisible();
    await expect(page.getByText("Test Resident", { exact: true }).last()).toBeVisible();
    await expect(page.getByText("Your registered full name will be publicly displayed with this report.")).toBeVisible();
    await expect(page.getByLabel("Reporter name")).toHaveCount(0);
    await expect(page.getByRole("checkbox", { name: /anonymous/i })).toHaveCount(0);
  });
}
