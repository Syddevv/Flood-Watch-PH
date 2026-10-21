import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";
import { hashSessionToken } from "@/lib/auth-session-token";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
test.skip(!testDatabaseUrl || process.env.DATABASE_URL !== testDatabaseUrl, "Requires matching isolated TEST_DATABASE_URL and DATABASE_URL.");
const userId = randomUUID(), token = randomUUID(), rescueId = randomUUID();
let db: PrismaClient;

test.beforeAll(async () => {
  db = new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl! }) });
  await db.user.create({ data: { id: userId, email: `a5-${userId}@example.com`, passwordHash: "unused", role: "admin", emailVerificationStatus: "verified", emailVerifiedAt: new Date() } });
  await db.session.create({ data: { userId, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + 10 * 60_000) } });
  await db.rescueRequest.create({ data: { id: rescueId, reference: `RR-A5${rescueId.slice(0, 10)}`, creatorUserId: userId, requesterUserId: userId, intakeChannel: "public", idempotencyKey: randomUUID(), idempotencyHash: "fixture", forWhom: "self", primaryContact: "09171234567", peopleCount: 1, vulnerabilityTags: [], description: "Fixture", locationName: "Fixture", locationUncertainty: "manual", localityCode: "0301407000", barangay: "Meysulao" } });
});

test.afterAll(async () => {
  if (!db) return;
  await db.rescueRequest.deleteMany({ where: { id: rescueId } });
  await db.session.deleteMany({ where: { userId } });
  await db.user.deleteMany({ where: { id: userId } });
  await db.$disconnect();
});

test("live filters and CSV agree, and chart bars expose keyboard details", async ({ page }) => {
  await page.context().addCookies([{ name: "floodwatch_auth_session", value: token, url: baseUrl }]);
  await page.goto("/admin/analytics");
  await expect(page.getByRole("heading", { name: "Operational analytics" })).toBeVisible();
  await expect(page.getByText(/Data checked/)).toBeVisible();
  const card = page.getByRole("heading", { name: "Rescue requests", exact: true }).locator("..");
  const count = Number((await card.locator("p.text-3xl").textContent())?.replaceAll(",", ""));
  assert.ok(count >= 1);
  const chartBar = page.getByRole("button", { name: /Rescue requests \d+/ }).first();
  await chartBar.focus();
  const tooltip = page.getByTestId("volume-tooltip");
  await expect(tooltip).toContainText("Rescue requests:");
  const chart = page.getByRole("region", { name: "Operational volume chart" });
  const chartBounds = await chart.boundingBox();
  const tooltipBounds = await tooltip.boundingBox();
  assert.ok(chartBounds && tooltipBounds);
  assert.ok(tooltipBounds.x >= chartBounds.x && tooltipBounds.x + tooltipBounds.width <= chartBounds.x + chartBounds.width);
  assert.ok(tooltipBounds.y >= chartBounds.y && tooltipBounds.y + tooltipBounds.height <= chartBounds.y + chartBounds.height);
  await page.getByRole("button", { name: /Rescue requests \d+/ }).last().hover();
  await expect(tooltip).toBeVisible();
  const href = await page.getByRole("link", { name: "Download matching CSV" }).getAttribute("href");
  const csvResponse = await page.request.get(`${baseUrl}${href}`, { headers: { Cookie: `floodwatch_auth_session=${token}` } });
  assert.equal(csvResponse.status(), 200);
  assert.ok((await csvResponse.text()).includes(`"rescue requests","${count}","complete"`));
  await page.getByRole("combobox", { name: "Analytics municipality" }).selectOption("0301407000");
  await expect(page.getByText(/Locality not recorded for this source/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Rescue requests", exact: true }).locator("..")).toContainText(/\d/);
});

test("zero or partial views fit on a phone", async ({ page }) => {
  await page.context().addCookies([{ name: "floodwatch_auth_session", value: token, url: baseUrl }]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/analytics");
  await page.getByRole("combobox", { name: "Analytics municipality" }).selectOption("0301401000");
  await expect(page.getByText(/Locality not recorded for this source/)).toBeVisible();
  await expect(page.getByText(/No recorded volume in this range/)).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1);
});
