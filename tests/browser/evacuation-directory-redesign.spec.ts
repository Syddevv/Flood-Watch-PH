import { expect, test } from "@playwright/test";

const centers = [
  {
    id: "long-name", name: "Regional Evacuation Center and Community Support Building for Families",
    address: "New City Hall complex, Bulihan", barangay: "Bulihan", city: "City of Malolos",
    latitude: 14.8611111, longitude: 120.8105556, availability: "unknown", status: "needs_verification",
    verificationStatus: "official_publication_found", facilities: [], facilityType: "dedicated_evacuation_center",
    permanent: true, estimatedCapacity: 250, capacityFamilies: null, contactNumber: null,
    sourceCheckedAt: "2026-10-18T00:00:00.000Z", availabilityConfirmedAt: null,
    lastDocumentedEventDate: null, sourceUrl: "https://example.gov.ph/center",
    sourceLinks: [{ title: "City evacuation plan", url: "https://example.gov.ph/center", publishedAt: "2023-05-01" }],
    sourceNotes: "Published plan; opening not confirmed.", locationProvenance: "Source-published location; not field-confirmed",
  },
  {
    id: "no-location", name: "San Roque Barangay Hall", address: "San Roque, Angat",
    barangay: "San Roque", city: "Angat", latitude: null, longitude: null,
    availability: "unknown", status: "needs_verification", verificationStatus: "official_publication_found",
    facilities: [], facilityType: "barangay_hall", permanent: false, estimatedCapacity: null,
    capacityFamilies: null, contactNumber: null, sourceCheckedAt: null, availabilityConfirmedAt: null,
    lastDocumentedEventDate: null, sourceUrl: null, sourceLinks: [], sourceNotes: null, locationProvenance: null,
  },
];

async function openDirectory(page: import("@playwright/test").Page) {
  await page.route("**/api/evacuation-centers", (route) => route.fulfill({ json: { data: { centers } } }));
  await page.goto("/evacuation-centers");
  await expect(page.getByText("2 centers found")).toBeVisible();
}

test("list keeps cards simple and details accessible", async ({ page }) => {
  await openDirectory(page);
  await expect(page.getByRole("heading", { name: "Evacuation Centers" })).toBeVisible();
  await expect(page.getByLabel("Municipality or city")).toHaveValue("");
  const located = page.locator("#evacuation-center-long-name");
  await expect(located.getByText("Opening not confirmed")).toBeVisible();
  await expect(located.getByRole("link", { name: /Directions to/ })).toBeVisible();
  await expect(located).not.toContainText("Historical or planned capacity");
  await expect(located).not.toContainText("New City Hall complex");
  const unlocated = page.locator("#evacuation-center-no-location");
  await expect(unlocated.getByRole("link", { name: /Directions to/ })).toHaveCount(0);

  const detailsButton = located.getByRole("button", { name: /View details for/ });
  await detailsButton.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close details" })).toBeFocused();
  await expect(dialog.getByText("New City Hall complex, Bulihan")).toBeVisible();
  await expect(dialog.getByText("Please contact the local DRRMO before going.")).toBeVisible();
  await expect(dialog.getByText(/not a count of available spaces/)).toBeVisible();
  await expect(dialog.getByRole("link", { name: /City evacuation plan/ })).toBeHidden();
  await page.keyboard.press("Tab");
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await dialog.getByText("Sources and updates").click();
  await expect(dialog.getByRole("link", { name: /City evacuation plan/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(detailsButton).toBeFocused();

  await unlocated.getByRole("button", { name: /View details for/ }).click();
  await expect(page.getByRole("dialog").getByText("Exact location unavailable. Contact the local DRRMO for guidance.")).toBeVisible();
});

test("filters, reset, and empty results work on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDirectory(page);
  await page.getByLabel("Municipality or city").selectOption("Angat");
  await expect(page.getByText("1 center found")).toBeVisible();
  await page.getByLabel("Search by center or barangay").fill("missing");
  await expect(page.getByText("0 centers found")).toBeVisible();
  await expect(page.getByText(/No centers match this search/)).toBeVisible();
  await page.getByRole("button", { name: "Clear search and filters" }).click();
  await expect(page.getByText("2 centers found")).toBeVisible();
  await expect(page.getByLabel("Municipality or city")).toHaveValue("");
  await expect(page.getByLabel("Search by center or barangay")).toHaveValue("");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("a failed request offers a retry and a zoomed layout stays within the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 450 });
  let unavailable = true;
  await page.route("**/api/evacuation-centers", (route) => {
    return unavailable
      ? route.fulfill({ status: 503, json: { error: "Unavailable" } })
      : route.fulfill({ json: { data: { centers } } });
  });
  await page.goto("/evacuation-centers");
  await expect(page.getByText("Unable to load centers. Please try again.")).toBeVisible();
  unavailable = false;
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByText("2 centers found")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("a center link opens its details directly", async ({ page }) => {
  await page.route("**/api/evacuation-centers", (route) => route.fulfill({ json: { data: { centers } } }));
  await page.goto("/evacuation-centers?center=long-name");
  await expect(page.getByRole("dialog", { name: centers[0].name })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
