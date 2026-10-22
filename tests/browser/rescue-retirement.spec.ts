import { expect, test } from "@playwright/test";

test("retired citizen navigation and pages stay unavailable on desktop and mobile", async ({ page }) => {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/evacuation-centers");
    await expect(page.getByText("Request Rescue", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Evacuation Centers" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }
  for (const path of ["/rescue-request", "/rescue-request/legacy-id", "/admin/rescue-requests", "/admin/responders"]) {
    const response = await page.request.get(path);
    expect(response.status(), path).toBe(404);
  }
  for (const path of ["/api/rescue-requests", "/api/admin/rescue-requests", "/api/admin/responders"]) {
    const response = await page.request.post(path, { data: {} });
    expect(response.status(), path).toBe(404);
  }
});
