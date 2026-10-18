import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";
import { hashSessionToken } from "@/lib/auth-session-token";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
test.skip(!testDatabaseUrl || process.env.DATABASE_URL !== testDatabaseUrl, "Requires matching isolated TEST_DATABASE_URL and DATABASE_URL.");
const userId = randomUUID(), token = randomUUID();
let db: PrismaClient;

test.beforeAll(async () => {
  db = new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl! }) });
  await db.user.create({ data: { id: userId, email: `a3-browser-${userId}@example.com`, passwordHash: "unused", role: "admin", emailVerificationStatus: "verified", emailVerifiedAt: new Date() } });
  await db.session.create({ data: { userId, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + 10 * 60_000) } });
});

test.afterAll(async () => {
  if (!db) return;
  const requestIds = (await db.rescueRequest.findMany({ where: { creatorUserId: userId }, select: { id: true } })).map((request) => request.id);
  await db.adminNotification.deleteMany({ where: { targetId: { in: requestIds } } });
  await db.rescueRequestEvent.deleteMany({ where: { requestId: { in: requestIds } } });
  await db.rescueRequest.deleteMany({ where: { creatorUserId: userId } });
  await db.session.deleteMany({ where: { userId } });
  await db.user.delete({ where: { id: userId } });
  await db.$disconnect();
});

async function signIn(page: Page) {
  await page.context().addCookies([{ name: "floodwatch_auth_session", value: token, url: "http://localhost:3000" }]);
}

async function fillIntake(page: Page) {
  const form = page.getByTestId("admin-rescue-intake-form");
  await form.getByLabel("Callback number").fill("09171234567");
  await form.getByLabel("Situation").fill("Water is rising at the house");
  await form.getByLabel("City or municipality").selectOption("0301407000");
  await form.getByLabel("Barangay").fill("Meysulao");
  await form.getByLabel("Place description").fill("Near the barangay hall");
}

test("modal traps focus, protects unfinished input, and records one admin-assisted request after retry", async ({ page }) => {
  await signIn(page);
  await page.goto("/admin/rescue-requests");
  await page.getByRole("button", { name: "New rescue" }).click();
  const modal = page.getByRole("dialog", { name: "New rescue request" });
  await expect(modal).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.activeElement?.closest("dialog") !== null)).toBe(true);
  await fillIntake(page);
  await page.getByRole("radio", { name: "Walk-in" }).check();
  await page.getByLabel("Initial priority").selectOption("critical");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.keyboard.press("Escape");
  await expect(modal).toBeVisible();
  const keys: string[] = [];
  await page.route("**/api/admin/rescue-requests", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    keys.push(route.request().headers()["idempotency-key"]);
    if (keys.length === 1) return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Temporary outage" }) });
    return route.continue();
  });
  await page.getByTestId("admin-rescue-submit").click();
  await expect(modal.getByRole("alert")).toContainText("Temporary outage");
  await expect(page.getByLabel("Callback number")).toHaveValue("09171234567");
  await page.getByTestId("admin-rescue-submit").click();
  await expect(modal).not.toBeVisible();
  await expect(page.getByRole("status")).toContainText("recorded");
  assert.equal(keys.length, 2);
  assert.equal(keys[0], keys[1]);
  const created = await db.rescueRequest.findMany({ where: { creatorUserId: userId } });
  assert.equal(created.length, 1);
  assert.equal(created[0].intakeChannel, "admin_assisted");
  assert.equal(created[0].assistedIntakeMethod, "walk_in");
  assert.equal(created[0].priority, "critical");
  await expect(page.getByRole("listitem").filter({ hasText: created[0].reference })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "New rescue" })).toBeFocused();
});

test("direct new-request URL remains usable on a phone", async ({ page }) => {
  await signIn(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/rescue-requests/new");
  await expect(page.getByRole("heading", { name: "New rescue request" })).toBeVisible();
  await expect(page.getByTestId("admin-rescue-intake-form")).toBeVisible();
  await fillIntake(page);
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("link", { name: "← Rescue requests" }).click();
  await expect(page).toHaveURL(/\/admin\/rescue-requests\/new$/);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
