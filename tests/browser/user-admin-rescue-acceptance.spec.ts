import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";
import { hashSessionToken } from "@/lib/auth-session-token";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
test.skip(!testDatabaseUrl || process.env.DATABASE_URL !== testDatabaseUrl, "Requires matching isolated TEST_DATABASE_URL and DATABASE_URL.");

test("resident submission reaches admin completion and returns a private-safe timeline", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: testDatabaseUrl! }) });
  const ownerId = randomUUID(), otherId = randomUUID(), adminId = randomUUID();
  const ownerToken = randomUUID(), otherToken = randomUUID(), adminToken = randomUUID();
  const userIds = [ownerId, otherId, adminId];
  let adminContext: Awaited<ReturnType<typeof browser.newContext>> | undefined;
  try {
    for (const [index, id] of userIds.entries()) {
      await db.user.create({ data: { id, email: `u6-${id}@example.com`, passwordHash: "unused", role: index === 2 ? "admin" : "user", emailVerificationStatus: "verified", emailVerifiedAt: new Date() } });
    }
    for (const [index, token] of [ownerToken, otherToken, adminToken].entries()) {
      await db.session.create({ data: { userId: userIds[index], tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + 10 * 60_000) } });
    }

    await page.context().addCookies([{ name: "floodwatch_auth_session", value: ownerToken, url: "http://localhost:3000" }]);
    await page.goto("/rescue-request");
    await page.getByTestId("rescue-locality").selectOption("0301407000");
    await page.getByTestId("rescue-barangay").fill("Meysulao");
    await page.getByTestId("rescue-location-name").fill("Near Meysulao barangay hall");
    await page.getByTestId("rescue-situation").fill("Floodwater has reached the front steps.");
    await page.getByTestId("rescue-contact").fill("09171234567");
    await page.getByTestId("rescue-submit").click();
    await expect(page.getByTestId("rescue-success")).toContainText("not that a team was dispatched");

    const saved = await db.rescueRequest.findFirstOrThrow({ where: { requesterUserId: ownerId } });
    assert.equal(saved.intakeChannel, "public");
    await expect(page.getByText(saved.reference).first()).toBeVisible();
    await page.goto(`/rescue-request/${saved.id}`);
    await expect(page.getByRole("heading", { name: "Request received" })).toBeVisible();
    await expect(page.getByText("A request receipt does not confirm that a team has been dispatched.")).toBeVisible();

    const otherRead = await fetch(`http://localhost:3000/api/rescue-requests/${saved.id}`, { headers: { Cookie: `floodwatch_auth_session=${otherToken}` } });
    assert.equal(otherRead.status, 404);

    adminContext = await browser.newContext({ baseURL: "http://localhost:3000" });
    await adminContext.addCookies([{ name: "floodwatch_auth_session", value: adminToken, url: "http://localhost:3000" }]);
    const adminPage = await adminContext.newPage();
    await adminPage.goto("/admin/rescue-requests");
    await expect(adminPage.getByText(saved.reference)).toBeVisible();
    await adminPage.getByText(saved.reference).click();
    await expect(adminPage.getByRole("heading", { name: saved.reference })).toBeVisible();
    await adminPage.getByLabel("Change status").selectOption("triaged");
    await adminPage.getByRole("button", { name: "Save status" }).click();
    await expect(adminPage.getByText("triaged · routine priority")).toBeVisible();

    await adminPage.getByLabel("Note", { exact: true }).fill("Private callback details for operators only");
    await adminPage.getByRole("button", { name: "Add note" }).click();
    await expect(adminPage.getByText("Private callback details for operators only")).toBeVisible();
    await adminPage.getByLabel("Note", { exact: true }).fill("An operator reviewed your request.");
    await adminPage.getByLabel("Visibility").selectOption("public");
    await adminPage.getByRole("button", { name: "Add note" }).click();

    await adminPage.getByLabel("Case owner (administrator, not responder)").selectOption(adminId);
    await adminPage.getByRole("button", { name: "Assign case owner" }).click();
    await expect(adminPage.getByText("assigned · routine priority")).toBeVisible();
    await adminPage.getByLabel("Change status").selectOption("en_route");
    await adminPage.getByLabel("How was dispatch acknowledged? (internal)").fill("Team leader accepted by phone.");
    await adminPage.getByLabel("Confirmed responder/team reference").fill("U6-test-team-confirmed");
    await adminPage.getByRole("checkbox", { name: /I directly confirmed this team accepted/ }).check();
    await adminPage.getByRole("button", { name: "Save status" }).click();
    await expect(adminPage.getByText("en route · routine priority")).toBeVisible();
    await adminPage.getByLabel("Change status").selectOption("on_scene");
    await adminPage.getByRole("button", { name: "Save status" }).click();
    await expect(adminPage.getByText("on scene · routine priority")).toBeVisible();
    await adminPage.getByLabel("Change status").selectOption("completed");
    await adminPage.getByLabel("Recorded outcome").fill("Resident reached the agreed safe pickup point.");
    await adminPage.getByRole("button", { name: "Save status" }).click();
    await expect(adminPage.getByText("completed · routine priority")).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: "Completed" })).toBeVisible();
    await expect(page.getByText("An operator reviewed your request.")).toBeVisible();
    await expect(page.getByText("Private callback details for operators only")).toHaveCount(0);
    const final = await db.rescueRequest.findUniqueOrThrow({ where: { id: saved.id } });
    assert.equal(final.status, "completed");
    assert.equal(final.caseOwnerUserId, adminId);
    assert.equal(final.confirmedTeamReference, "U6-test-team-confirmed");
    assert.ok(final.outcome);
  } finally {
    await adminContext?.close();
    const requestIds = (await db.rescueRequest.findMany({ where: { requesterUserId: ownerId }, select: { id: true } })).map(({ id }) => id);
    await db.adminNotification.deleteMany({ where: { targetId: { in: requestIds } } });
    await db.rescueRequestEvent.deleteMany({ where: { requestId: { in: requestIds } } });
    await db.rescueRequest.deleteMany({ where: { id: { in: requestIds } } });
    await db.session.deleteMany({ where: { userId: { in: userIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  }
});
