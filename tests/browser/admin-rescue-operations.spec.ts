import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";
import { hashSessionToken } from "@/lib/auth-session-token";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
test.skip(!testDatabaseUrl || process.env.DATABASE_URL !== testDatabaseUrl, "Requires matching isolated TEST_DATABASE_URL and DATABASE_URL.");

const ids = [randomUUID(), randomUUID(), randomUUID()];
const tokens = [randomUUID(), randomUUID()];
const requestId = randomUUID();
const reference = `RR-A4${requestId.slice(0, 10).toUpperCase()}`;
let db: PrismaClient;

test.beforeAll(async () => {
  db = new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl! }) });
  for (const [index, id] of ids.entries()) {
    await db.user.create({ data: { id, email: `a4-${id}@example.com`, passwordHash: "unused", role: index < 2 ? "admin" : "user", emailVerificationStatus: "verified", emailVerifiedAt: new Date() } });
  }
  for (const [index, token] of tokens.entries()) await db.session.create({ data: { userId: ids[index], tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + 10 * 60_000) } });
  await db.rescueRequest.create({ data: {
    id: requestId, reference, requesterUserId: ids[2], creatorUserId: ids[2], intakeChannel: "public",
    idempotencyKey: randomUUID(), idempotencyHash: "test", forWhom: "self", primaryContact: "09171234567",
    peopleCount: 2, vulnerabilityTags: [], description: "Water is rising", locationName: "Near barangay hall",
    locationUncertainty: "manual", localityCode: "0301407000", barangay: "Meysulao",
  } });
  await db.rescueRequestEvent.create({ data: { requestId, actorUserId: ids[2], eventType: "received", nextStatus: "received", visibility: "public" } });
});

test.afterAll(async () => {
  if (!db) return;
  await db.adminNotification.deleteMany({ where: { targetId: requestId } });
  await db.rescueRequestEvent.deleteMany({ where: { requestId } });
  await db.rescueRequest.deleteMany({ where: { id: requestId } });
  await db.session.deleteMany({ where: { userId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
});

test("queue, detail actions and a second-admin conflict use live state", async ({ page }) => {
  await page.context().addCookies([{ name: "floodwatch_auth_session", value: tokens[0], url: baseUrl }]);
  await page.goto("/admin/rescue-requests");
  await expect(page.getByText(reference)).toBeVisible();
  await page.getByRole("combobox", { name: "Rescue status filter" }).selectOption("received");
  await expect(page.getByText(reference)).toBeVisible();
  await page.getByText(reference).click();
  await expect(page.getByRole("heading", { name: reference })).toBeVisible();
  await page.getByLabel("Change status").selectOption("triaged");
  await page.getByRole("button", { name: "Save status" }).click();
  await expect(page.getByText("First triage:")).not.toContainText("Not yet");
  await page.getByLabel("Case owner (administrator, not responder)").selectOption(ids[0]);
  await page.getByRole("button", { name: "Assign case owner" }).click();
  await expect(page.getByText("assigned · routine priority")).toBeVisible();
  assert.equal((await db.rescueRequest.findUniqueOrThrow({ where: { id: requestId } })).caseOwnerUserId, ids[0]);

  const competing = await page.request.post(`${baseUrl}/api/admin/rescue-requests/${requestId}/actions`, {
    headers: { Cookie: `floodwatch_auth_session=${tokens[1]}`, Origin: baseUrl },
    data: { expectedVersion: 3, action: "priority", priority: "urgent" },
  });
  expect(competing.status()).toBe(200);
  await page.getByRole("combobox", { name: "Priority" }).selectOption("critical");
  await page.getByRole("button", { name: "Update priority" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Another administrator updated this request" })).toBeVisible();
  await expect(page.getByText("assigned · urgent priority")).toBeVisible();
});

test("queue remains usable at phone width", async ({ page }) => {
  await page.context().addCookies([{ name: "floodwatch_auth_session", value: tokens[0], url: baseUrl }]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/rescue-requests");
  await expect(page.getByText(reference)).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
