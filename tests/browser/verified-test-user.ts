import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";

export async function registerVerifiedTestUser(page: Page, prefix: string) {
  if (!process.env.TEST_DATABASE_URL || process.env.TEST_DATABASE_URL !== process.env.DATABASE_URL) {
    throw new Error("Browser account fixtures require an isolated TEST_DATABASE_URL matching DATABASE_URL.");
  }
  const code = process.env.EMAIL_VERIFICATION_TEST_CODE;
  if (!code) throw new Error("EMAIL_VERIFICATION_TEST_CODE is required for browser account fixtures.");

  const clientAddress = `browser-${randomUUID()}`;
  await page.context().setExtraHTTPHeaders({ "X-Forwarded-For": clientAddress });
  await page.goto("/incident-reports");
  const origin = new URL(page.url()).origin;
  const email = `${prefix}-${randomUUID()}@example.com`;
  const { randomBytes } = await import("node:crypto");
  const { prisma } = await import("@/lib/prisma");
  const locationToken = randomBytes(32).toString("hex");
  await prisma.registrationLocationVerification.create({ data: { id: locationToken, email,
    fullAddress: "Malolos, Bulacan, Philippines", cityMunicipality: "Malolos",
    expiresAt: new Date(Date.now() + 10 * 60 * 1000) } });
  const headers = { Origin: origin, "Content-Type": "application/json" };
  const registration = await page.request.post("/api/auth/register", {
    headers,
    data: { email, password: "correct-horse-battery1", fullName: "Test Resident", locationToken },
  });
  expect(registration.status()).toBe(202);
  const verification = await page.request.post("/api/auth/verify-code", {
    headers,
    data: { email, code },
  });
  expect(verification.status()).toBe(200);
  await page.reload();
}
