import { expect, test } from "@playwright/test";

test("native filters keep inset arrows, readable labels, and their values on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/emergency-contacts") return route.fulfill({ json: { data: { contacts: [
      { id: "fire", agencyName: "Baliwag Fire Station", contactNumber: "766-3250", category: "fire", city: "City of Baliwag", province: "Bulacan", isNational: false, preferred: false, phones: [{ raw: "766-3250", telUri: null }], sourceUrl: "https://example.gov.ph/fire", lastSourceCheckedAt: "2026-10-18T00:00:00Z", sourceFreshness: null, sourceLinks: [], sourceNotes: null, emails: [], isStale: false },
    ] } } });
    if (path === "/api/auth/session") return route.fulfill({ json: { data: { user: null } } });
    if (path === "/api/evacuation-centers") return route.fulfill({ json: { data: { centers: [] } } });
    return route.fulfill({ status: 204, body: "" });
  });
  await page.goto("/emergency-hotlines");

  const municipality = page.getByLabel("Municipality or city");
  const styles = await municipality.evaluate((element) => {
    const style = getComputedStyle(element);
    return { appearance: style.appearance, padding: Number.parseFloat(style.paddingRight), image: style.backgroundImage, position: style.backgroundPosition };
  });
  expect(styles.appearance).toBe("none");
  expect(styles.padding).toBeGreaterThanOrEqual(40);
  expect(styles.image).toContain("svg");
  expect(styles.position).toContain("14px");

  await municipality.selectOption("City of Baliwag");
  await expect(municipality).toHaveValue("City of Baliwag");
  await page.getByText("More filters").click();
  const category = page.getByLabel("Service category");
  await expect(category.locator('option[value="fire"]')).toHaveText("Fire");
  await category.selectOption("fire");
  await expect(category).toHaveValue("fire");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
  await expect(municipality).toHaveCSS("color-scheme", "dark");
});
