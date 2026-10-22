import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";
import test from "node:test";

export const testDatabaseUrl = process.env.TEST_DATABASE_URL;

export const integrationTest = testDatabaseUrl ? test : (test as typeof test).skip;

export function createReportForm(
  overrides: {
    latitude?: string;
    longitude?: string;
    forceNewIncident?: boolean;
    titleSuffix?: string;
  } = {},
) {
  const latitude = overrides.latitude ?? "14.916";
  const longitude = overrides.longitude ?? "120.766";
  const capturedAt = new Date().toISOString();
  const form = new FormData();
  form.set("title", `Integration report ${Date.now()}${overrides.titleSuffix ? ` ${overrides.titleSuffix}` : ""}`);
  form.set("description", "Integration test report.");
  form.set("category", "Flooding");
  form.set("severity", "High");
  form.set("locationName", "Poblacion, Calumpit");
  form.set("reportedByName", "Forged browser name must be ignored");
  form.set("latitude", latitude);
  form.set("longitude", longitude);
  form.set("locationSource", "gps");
  form.set("gpsLatitude", latitude);
  form.set("gpsLongitude", longitude);
  form.set("gpsAccuracyMeters", "10");
  form.set("gpsCapturedAt", capturedAt);
  form.set("photoCapturedAt", capturedAt);
  form.set(
    "image",
    new File(
      [
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
          "base64",
        ),
      ],
      "onsite-report.png",
      { type: "image/png" },
    ),
  );
  if (overrides.forceNewIncident) {
    form.set("forceNewIncident", "true");
  }
  return form;
}

export async function getAvailablePort() {
  return new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Unable to reserve a test server port."));
        return;
      }

      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(address.port);
      });
    });
  });
}

export function cookieFromResponse(response: Response) {
  const setCookie = response.headers.get("set-cookie");
  assert.ok(setCookie, "The endpoint must set a session cookie.");
  return setCookie.split(";")[0];
}

async function waitForServer(server: ChildProcess, baseUrl: string) {
  const deadline = Date.now() + 60_000;

  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Next.js test server exited with code ${server.exitCode}.`);
    }

    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // The dev server can take several seconds to compile its first route.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error("Timed out waiting for the Next.js test server.");
}

/**
 * Kills the full process tree spawned for a test server, including Next's
 * Turbopack workers. Left-behind descendants can keep holding Next's
 * per-project dev-server lock in `.next/`, causing the *next* `next dev`
 * invocation from the same working directory to immediately exit instead
 * of starting (surfaced as "Next.js test server exited with code 1").
 */
export async function stopServer(server: ChildProcess) {
  const closePipes = () => { server.stdout?.destroy(); server.stderr?.destroy(); server.stdin?.destroy(); };
  if (server.exitCode !== null || server.pid === undefined) {
    closePipes();
    return;
  }

  const exited = new Promise<void>((resolve) => {
    server.once("exit", () => resolve());
  });

  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(server.pid), "/t", "/f"]);
  } else {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      server.kill("SIGTERM");
    }
  }

  const exitedInTime = await Promise.race([
    exited.then(() => true),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5_000)),
  ]);

  if (exitedInTime) {
    closePipes();
    return;
  }

  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(server.pid), "/t", "/f"]);
  } else {
    try {
      process.kill(-server.pid, "SIGKILL");
    } catch {
      server.kill("SIGKILL");
    }
  }

  await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 5_000))]);
  closePipes();
}

export async function startTestServer(
  envOverrides: Record<string, string | undefined> = {},
) {
  const port = await getAvailablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const output: string[] = [];
  const server = spawn(
    process.execPath,
    [resolve(process.cwd(), "node_modules", "next", "dist", "bin", "next"), "dev", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: testDatabaseUrl,
        DIRECT_URL: testDatabaseUrl,
        NODE_ENV: "test",
        FLOODWATCH_TEST_DIST_DIR: ".next-integration",
        REPORT_IMAGE_UPLOAD_TEST_STUB: "true",
        EMAIL_PROVIDER: "emailjs",
        EMAILJS_SERVICE_ID: "service_integration_test_only",
        EMAILJS_TEMPLATE_ID: "template_integration_test_only",
        EMAILJS_PUBLIC_KEY: "public_integration_test_only",
        EMAILJS_PRIVATE_KEY: "private_integration_test_only",
        EMAIL_VERIFICATION_HMAC_KEY:
          "integration-email-verification-hmac-key-32-chars",
        EMAIL_DELIVERY_TEST_STUB:
          process.env.EMAIL_DELIVERY_TEST_STUB ?? "success",
        EMAIL_VERIFICATION_TEST_CODE: "123456",
        LEGACY_EMAIL_GRACE_DEADLINE: "2099-01-01T00:00:00.000Z",
        REPORT_SESSION_SECRET:
          process.env.REPORT_SESSION_SECRET ??
          "integration-test-report-session-secret-32-chars",
        ABUSE_PROTECTION_SECRET:
          process.env.ABUSE_PROTECTION_SECRET ??
          "integration-test-abuse-protection-secret-32-chars",
        TRUSTED_PROXY_CLIENT_IP_HEADER: "x-forwarded-for",
        ...envOverrides,
      },
      // Own process group on POSIX so stopServer() can signal Next and its workers.
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  server.stdout?.on("data", (chunk) => output.push(String(chunk)));
  server.stderr?.on("data", (chunk) => output.push(String(chunk)));

  try {
    await waitForServer(server, baseUrl);
  } catch (error) {
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\n--- test server output ---\n${output.join("")}`,
    );
  }

  return { baseUrl, server, output };
}

export async function createAnonymousSession(baseUrl: string, clientAddress: string) {
  const response = await fetch(`${baseUrl}/api/report-session`, {
    method: "POST",
    headers: {
      Origin: baseUrl,
      "Content-Type": "application/json",
      "X-Forwarded-For": clientAddress,
    },
    body: "{}",
  });

  assert.equal(response.status, 200);
  return cookieFromResponse(response);
}

/**
 * Registers a fresh, uniquely-emailed user and returns their auth session
 * cookie. `POST /api/reports` requires real authentication (Priority 1) -
 * an anonymous report-session cookie is no longer sufficient to create a
 * report, so any test that submits a report needs this instead of
 * `createAnonymousSession`.
 */
export async function createAuthenticatedSession(baseUrl: string, clientAddress: string) {
  const email = `integration-${clientAddress}@example.com`;
  const locationToken = await createTestLocationVerification(email);
  const registrationResponse = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: {
      Origin: baseUrl,
      "Content-Type": "application/json",
      "X-Forwarded-For": clientAddress,
    },
    body: JSON.stringify({ email, password: "integration-test-password1", fullName: "Test Resident", locationToken }),
  });

  assert.equal(registrationResponse.status, 202);

  const verificationResponse = await fetch(`${baseUrl}/api/auth/verify-code`, {
    method: "POST",
    headers: {
      Origin: baseUrl,
      "Content-Type": "application/json",
      "X-Forwarded-For": clientAddress,
    },
    body: JSON.stringify({ email, code: "123456" }),
  });

  assert.equal(verificationResponse.status, 200);
  return cookieFromResponse(verificationResponse);
}

export async function createTestLocationVerification(email: string) {
  const { randomBytes } = await import("node:crypto");
  const { prisma } = await import("@/lib/prisma");
  const id = randomBytes(32).toString("hex");
  await prisma.registrationLocationVerification.create({
    data: { id, email, fullAddress: "Malolos, Bulacan, Philippines", cityMunicipality: "Malolos",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
  });
  return id;
}
