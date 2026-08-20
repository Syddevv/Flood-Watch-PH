import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import test from "node:test";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

async function getAvailablePort() {
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

function cookieFromResponse(response: Response) {
  const setCookie = response.headers.get("set-cookie");
  assert.ok(setCookie, "The session endpoint must set a session cookie.");
  return setCookie.split(";")[0];
}

async function waitForServer(process: ChildProcess, baseUrl: string) {
  const deadline = Date.now() + 60_000;

  while (Date.now() < deadline) {
    if (process.exitCode !== null) {
      throw new Error(`Next.js test server exited with code ${process.exitCode}.`);
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

async function createSession(baseUrl: string, clientAddress: string) {
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

function createReportForm() {
  const form = new FormData();
  form.set("title", `Integration report ${Date.now()}`);
  form.set("description", "Integration test report.");
  form.set("category", "Flooding");
  form.set("severity", "High");
  form.set("locationName", "Marikina City");
  form.set("reportedByName", "Automated integration test");
  form.set("latitude", "14.6507");
  form.set("longitude", "121.1029");
  return form;
}

async function stopServer(process: ChildProcess) {
  if (process.exitCode !== null) {
    return;
  }

  process.kill();
  await new Promise<void>((resolve) => {
    process.once("exit", () => resolve());
    setTimeout(resolve, 5_000);
  });
}

const integrationTest = testDatabaseUrl
  ? test
  : (test as typeof test).skip;

integrationTest(
  "report API enforces ownership, duplicate actions, and concurrent undo consistency",
  async () => {
    const port = await getAvailablePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    const runId = randomUUID();
    const ownerAddress = `integration-owner-${runId}`;
    const otherAddress = `integration-other-${runId}`;
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
        },
        stdio: "ignore",
      },
    );

    let reportId = "";
    let ownerCookie = "";

    try {
      await waitForServer(server, baseUrl);

      ownerCookie = await createSession(baseUrl, ownerAddress);
      const otherCookie = await createSession(baseUrl, otherAddress);
      const thirdAddress = `integration-third-${runId}`;
      const thirdCookie = await createSession(baseUrl, thirdAddress);
      const reportResponse = await fetch(`${baseUrl}/api/reports`, {
        method: "POST",
        headers: {
          Origin: baseUrl,
          Cookie: ownerCookie,
          "X-Forwarded-For": ownerAddress,
        },
        body: createReportForm(),
      });
      const reportPayload = (await reportResponse.json()) as {
        data?: { id?: string; isOwner?: boolean };
      };

      assert.equal(reportResponse.status, 201);
      assert.equal(reportPayload.data?.isOwner, true);
      assert.ok(reportPayload.data?.id);
      reportId = reportPayload.data.id;

      const otherDelete = await fetch(`${baseUrl}/api/reports/${reportId}`, {
        method: "DELETE",
        headers: {
          Origin: baseUrl,
          Cookie: otherCookie,
          "X-Forwarded-For": otherAddress,
        },
      });
      assert.equal(otherDelete.status, 403);

      const confirmRequest = () =>
        fetch(`${baseUrl}/api/reports/${reportId}/confirm`, {
          method: "POST",
          headers: {
            Origin: baseUrl,
            Cookie: otherCookie,
            "X-Forwarded-For": otherAddress,
          },
        });

      assert.equal((await confirmRequest()).status, 200);
      assert.equal((await confirmRequest()).status, 409);

      const secondConfirm = await fetch(`${baseUrl}/api/reports/${reportId}/confirm`, {
        method: "POST",
        headers: {
          Origin: baseUrl,
          Cookie: thirdCookie,
          "X-Forwarded-For": thirdAddress,
        },
      });
      assert.equal(secondConfirm.status, 200);

      const [firstUndo, secondUndo] = await Promise.all([
        fetch(`${baseUrl}/api/reports/${reportId}/confirm`, {
          method: "DELETE",
          headers: {
            Origin: baseUrl,
            Cookie: otherCookie,
            "X-Forwarded-For": otherAddress,
          },
        }),
        fetch(`${baseUrl}/api/reports/${reportId}/confirm`, {
          method: "DELETE",
          headers: {
            Origin: baseUrl,
            Cookie: thirdCookie,
            "X-Forwarded-For": thirdAddress,
          },
        }),
      ]);
      assert.deepEqual([firstUndo.status, secondUndo.status].sort(), [200, 200]);

      const reportAfterUndo = await fetch(`${baseUrl}/api/reports/${reportId}`, {
        headers: { Cookie: ownerCookie, "X-Forwarded-For": ownerAddress },
      });
      const reportAfterUndoPayload = (await reportAfterUndo.json()) as {
        data?: { confirmationCount?: number };
      };
      assert.equal(reportAfterUndoPayload.data?.confirmationCount, 0);

      const ownerDelete = await fetch(`${baseUrl}/api/reports/${reportId}`, {
        method: "DELETE",
        headers: {
          Origin: baseUrl,
          Cookie: ownerCookie,
          "X-Forwarded-For": ownerAddress,
        },
      });
      assert.equal(ownerDelete.status, 200);
    } finally {
      if (reportId && ownerCookie) {
        await fetch(`${baseUrl}/api/reports/${reportId}`, {
          method: "DELETE",
          headers: {
            Origin: baseUrl,
            Cookie: ownerCookie,
            "X-Forwarded-For": ownerAddress,
          },
        }).catch(() => undefined);
      }
      await stopServer(server);
    }
  },
);
