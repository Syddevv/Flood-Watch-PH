import { expect, test } from "@playwright/test";

const base = {
  contactNumber: "911", callHref: "tel:911", category: "rescue", description: null,
  province: "Bulacan", isNational: false, sourceUrl: "https://example.gov.ph/current",
  lastSourceCheckedAt: "2026-10-18T00:00:00Z", isStale: false,
  sourceFreshness: "dated_advisory_or_agency_page", preferred: false,
  sourceLinks: [{ title: "Official notice", url: "https://example.gov.ph/current", publishedAt: "2026-10-18" }],
  sourceNotes: null, emails: [],
};

const contacts = [
  { ...base, id: "preferred", agencyName: "Bulacan PDRRMO / Bulacan Rescue", city: null, preferred: true,
    phones: [{ raw: "911", telUri: "tel:911" }, { raw: "0917-123-4567", telUri: "tel:+639171234567" }],
    emails: ["help@bulacan.gov.ph"] },
  { ...base, id: "older", agencyName: "Bulacan PDRRMO", city: null, category: "Disaster Coordination",
    contactNumber: "(044) 791-0566", callHref: null, phones: [{ raw: "(044) 791-0566", telUri: null }],
    preferred: false, isStale: true, sourceFreshness: "undated_directory",
    sourceUrl: "https://example.gov.ph/old", sourceLinks: [{ title: "Older directory", url: "https://example.gov.ph/old", publishedAt: null }] },
  { ...base, id: "angat-fire", agencyName: "Angat Fire Station", city: "Angat", category: "fire",
    contactNumber: "671-7996", callHref: null, phones: [{ raw: "671-7996", telUri: null }] },
  { ...base, id: "malolos-police", agencyName: "Malolos Police Station With A Very Long Descriptive Agency Name", city: "City of Malolos", category: "police",
    contactNumber: "0918-234-5678", callHref: "tel:+639182345678", phones: [{ raw: "0918-234-5678", telUri: "tel:+639182345678" }] },
];

async function openDirectory(page: import("@playwright/test").Page) {
  await page.route(/\/api\/emergency-contacts(?:\?.*)?$/, (route) => route.fulfill({ json: { data: { contacts } } }));
  await page.goto("/emergency-hotlines");
  await expect(page.getByRole("heading", { name: "Emergency Contacts" })).toBeVisible();
}

test("preferred provincial group keeps older numbers in accessible details", async ({ page }) => {
  await openDirectory(page);
  const help = page.getByRole("region", { name: "Emergency help" });
  await expect(help.getByRole("article")).toHaveCount(1);
  await expect(help.getByText("911")).toBeVisible();
  await expect(help.getByRole("link", { name: "Call Bulacan PDRRMO / Bulacan Rescue at 911" })).toHaveAttribute("href", "tel:911");
  const trigger = help.getByRole("button", { name: "View details for Bulacan PDRRMO / Bulacan Rescue" });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Close details" })).toBeFocused();
  await expect(dialog.getByText("(044) 791-0566")).toBeVisible();
  await expect(dialog.getByText("Older published listing — this number may need updating.")).toBeVisible();
  await expect(dialog.getByText("help@bulacan.gov.ph")).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Older directory" })).toBeHidden();
  await dialog.getByText("Sources and updates").click();
  await expect(dialog.getByRole("link", { name: "Older directory" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("mobile filters keep provincial help visible and legacy number copyable", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.setViewportSize({ width: 390, height: 844 });
  await openDirectory(page);
  await page.getByLabel("Municipality or city").selectOption("Angat");
  await expect(page.getByRole("region", { name: "Emergency help" }).getByText("911")).toBeVisible();
  await expect(page.getByRole("region", { name: "Angat" }).getByText("Angat Fire Station")).toBeVisible();
  await expect(page.getByText("Malolos Police Station With A Very Long Descriptive Agency Name")).toHaveCount(0);
  await page.getByText("More filters").click();
  await page.getByLabel("Service category").selectOption("police");
  await expect(page.getByRole("region", { name: "Angat" }).getByText("No local contacts match.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  const fire = page.getByRole("article").filter({ hasText: "Angat Fire Station" });
  await fire.getByRole("button", { name: /Copy number for Angat Fire Station/ }).click();
  await expect(fire.getByRole("status")).toHaveText("Number copied.");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.evaluate(() => { document.body.style.zoom = "2"; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
