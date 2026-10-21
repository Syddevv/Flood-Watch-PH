import { expect, test } from "@playwright/test";

const centers = [
  {
    id: "long-name", name: "Regional Evacuation Center and Community Support Building for Families",
    address: "New City Hall complex, Bulihan", barangay: "Bulihan", city: "City of Malolos",
    latitude: 14.8611111, longitude: 120.8105556, availability: "unknown", status: "needs_verification", listingKind: "center", openingStatus: "unknown",
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
    availability: "unknown", status: "needs_verification", listingKind: "site", openingStatus: "unknown", verificationStatus: "official_publication_found",
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
  await expect(page.getByRole("heading", { name: "Evacuation Centers", exact: true })).toBeVisible();
  await expect(page.getByLabel("Municipality or city")).toHaveValue("");
  const located = page.locator("#evacuation-center-long-name");
  await expect(located.getByText("Listed evacuation center")).toBeVisible();
  await expect(located.getByText("Check opening before going.")).toBeVisible();
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
  await expect(dialog.getByText("Check with the local DRRMO before going.")).toBeVisible();
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
  await page.getByText("More filters").click();
  await expect(page.getByLabel("Opening status", { exact: true })).toHaveCount(0);
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

test("details modal keeps opening status plain and its header accessible while content scrolls", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 560 });
  await openDirectory(page);
  await page.locator("#evacuation-center-long-name").getByRole("button", { name: /View details for/ }).click();
  const dialog = page.getByRole("dialog");
  const openingStatus = dialog.locator("dt", { hasText: "Opening status" }).locator("..").locator("dd");
  await expect(openingStatus).toHaveText("Opening not confirmed");
  await expect(openingStatus).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(dialog.getByRole("link", { name: "View on map" })).toHaveAttribute("href", "/?center=long-name");
  await expect(dialog.getByRole("link", { name: "Directions" })).toHaveAttribute("href", /google\.com\/maps/);
  const content = dialog.locator(".overflow-y-auto");
  expect(await content.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await content.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect(dialog.getByRole("button", { name: "Close details" })).toBeVisible();
  await expect(dialog.getByText("Sources and updates")).toBeVisible();
  expect(await dialog.evaluate((element) => element.getBoundingClientRect().width <= window.innerWidth - 16)).toBe(true);
});

test("mapped cards link to the live map and unmapped cards explain why they cannot", async ({ page }) => {
  await openDirectory(page);
  const mapped = page.locator("#evacuation-center-long-name");
  const mapLink = mapped.getByRole("link", { name: /View .* on map/ });
  await expect(mapLink).toHaveAttribute("href", "/?center=long-name");
  const unmapped = page.locator("#evacuation-center-no-location");
  await expect(unmapped.getByText("Exact location unavailable")).toBeVisible();
  await expect(unmapped.getByRole("button", { name: /on map unavailable/ })).toBeDisabled();
  await mapLink.click();
  await expect(page).toHaveURL(/\?center=long-name$/);
  await expect(page.locator(".leaflet-popup-content").getByText(centers[0].name)).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Evacuation Centers", exact: true })).toBeVisible();
});

test("nearest sorting separates unknown distances, scrolls, and highlights results", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 14.86, longitude: 120.81 });
  await openDirectory(page);
  const results = page.getByRole("region", { name: "Evacuation center results" });
  const initialTop = await results.evaluate((element) => element.getBoundingClientRect().top);
  await page.getByLabel("Sort by").selectOption("nearest");
  await expect(page.getByText("Sorted by nearest distance · mapped locations first")).toBeVisible();
  await expect(page.getByText("Mapped evacuation centers · 1")).toBeVisible();
  await expect(page.getByText("Centers Awaiting Map Verification · 1")).toBeVisible();
  await expect(page.locator("#evacuation-center-long-name")).toContainText("km direct distance");
  await expect(results).toHaveClass(/ring-\[var\(--color-primary\)\]/);
  await expect.poll(() => results.evaluate((element) => element.getBoundingClientRect().top)).toBeLessThan(initialTop - 20);
});

test("default keeps source order within mapped and unmapped sections; name sort orders each group", async ({ page }) => {
  const mixedCenters = [
    centers[1],
    { ...centers[0], id: "z-mapped", name: "Zulu mapped center" },
    { ...centers[0], id: "a-mapped", name: "Alpha mapped center" },
    { ...centers[1], id: "a-unmapped", name: "Another unmapped center" },
  ];
  await page.route("**/api/evacuation-centers", (route) => route.fulfill({ json: { data: { centers: mixedCenters } } }));
  await page.goto("/evacuation-centers");
  await expect(page.getByText("4 centers found")).toBeVisible();
  const cards = page.locator('section[aria-label="Evacuation center results"] article');
  await expect(cards).toHaveCount(4);
  const mappedWidths = await cards.evaluateAll((nodes) => nodes.slice(0, 2).map((node) => node.getBoundingClientRect().width));
  expect(Math.abs(mappedWidths[0] - mappedWidths[1])).toBeLessThan(1);
  expect(await cards.evaluateAll((nodes) => nodes.map((node) => node.id))).toEqual([
    "evacuation-center-z-mapped", "evacuation-center-a-mapped", "evacuation-center-no-location", "evacuation-center-a-unmapped",
  ]);
  await page.getByLabel("Sort by").selectOption("name");
  await expect(page.getByText("Sorted by name A–Z within each location group")).toBeVisible();
  expect(await cards.evaluateAll((nodes) => nodes.map((node) => node.id))).toEqual([
    "evacuation-center-a-mapped", "evacuation-center-z-mapped", "evacuation-center-a-unmapped", "evacuation-center-no-location",
  ]);
  await page.getByLabel("Municipality or city").selectOption("Angat");
  await expect(page.getByText("Centers Awaiting Map Verification · 2")).toBeVisible();
  await expect(page.getByText(/Mapped evacuation centers/)).toHaveCount(0);
  await expect(cards).toHaveCount(2);
});

test("page sections and both card columns share the other directory's bounded width", async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 900 });
  await openDirectory(page);
  const boxes = await page.evaluate(() => {
    const bounds = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`Missing ${selector}`);
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width };
    };
    return {
      header: bounds("main header"), summary: bounds('[aria-label="Directory summary"]'),
      filters: bounds('[aria-label="Evacuation center filters"]'), results: bounds('[aria-label="Evacuation center results"]'),
      mappedGrid: bounds('[aria-label="Evacuation center results"] .grid'),
    };
  });
  for (const item of [boxes.summary, boxes.filters, boxes.results, boxes.mappedGrid]) {
    expect(Math.abs(item.left - boxes.header.left)).toBeLessThan(2);
    expect(Math.abs(item.right - boxes.header.right)).toBeLessThan(2);
  }
  expect(boxes.header.width).toBeGreaterThan(1000);
  expect(boxes.header.width).toBeLessThan(1152);
});
