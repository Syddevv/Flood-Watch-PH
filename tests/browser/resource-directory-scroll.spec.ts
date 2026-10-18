import { expect, test } from "@playwright/test";

for (const path of ["/evacuation-centers", "/emergency-hotlines"]) {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    test(`${path} scrolls at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(path);
      const contentPanel = page.locator("main").first();
      await expect(contentPanel).toBeVisible();

      const scrollTop = await contentPanel.evaluate((element) => {
        const spacer = document.createElement("div");
        spacer.style.height = "2000px";
        element.append(spacer);
        element.scrollTop = 1000;
        return element.scrollTop;
      });

      expect(scrollTop).toBeGreaterThan(0);
    });
  }
}
