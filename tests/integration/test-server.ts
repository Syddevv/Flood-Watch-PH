import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import test from "node:test";

export const testDatabaseUrl = process.env.TEST_DATABASE_URL;

export const integrationTest = testDatabaseUrl ? test : (test as typeof test).skip;

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
 * Kills the full process tree spawned for a test server, not just the
 * immediate `npm` child. `npm run dev` on Linux typically spawns a shell
 * that spawns `next dev`, which itself may spawn Turbopack workers;
 * signaling only the top `npm` PID does not reliably reach those
 * descendants in time. Left-behind descendants keep holding Next's
 * per-project dev-server lock in `.next/`, causing the *next* `next dev`
 * invocation from the same working directory to immediately exit instead
 * of starting (surfaced as "Next.js test server exited with code 1").
 */
export async function stopServer(server: ChildProcess) {
  if (server.exitCode !== null || server.pid === undefined) {
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
}

export async function startTestServer() {
  const port = await getAvailablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const output: string[] = [];
  const server = spawn(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: testDatabaseUrl,
        DIRECT_URL: testDatabaseUrl,
        NODE_ENV: "test",
        REPORT_SESSION_SECRET:
          process.env.REPORT_SESSION_SECRET ??
          "integration-test-report-session-secret-32-chars",
        ABUSE_PROTECTION_SECRET:
          process.env.ABUSE_PROTECTION_SECRET ??
          "integration-test-abuse-protection-secret-32-chars",
        TRUSTED_PROXY_CLIENT_IP_HEADER: "x-forwarded-for",
      },
      // Own process group on POSIX so stopServer() can signal the whole
      // tree (npm -> shell -> next dev -> Turbopack workers), not just npm.
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

  return { baseUrl, server };
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
