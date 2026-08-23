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

function createReportForm(
  overrides: {
    latitude?: string;
    longitude?: string;
    forceNewIncident?: boolean;
    titleSuffix?: string;
  } = {},
) {
  const form = new FormData();
  form.set("title", `Integration report ${Date.now()}${overrides.titleSuffix ? ` ${overrides.titleSuffix}` : ""}`);
  form.set("description", "Integration test report.");
  form.set("category", "Flooding");
  form.set("severity", "High");
  form.set("locationName", "Marikina City");
  form.set("reportedByName", "Automated integration test");
  form.set("latitude", overrides.latitude ?? "14.6507");
  form.set("longitude", overrides.longitude ?? "121.1029");
  if (overrides.forceNewIncident) {
    form.set("forceNewIncident", "true");
  }
  return form;
}

async function submitReport(
  baseUrl: string,
  cookie: string,
  address: string,
  overrides: Parameters<typeof createReportForm>[0] = {},
) {
  const response = await fetch(`${baseUrl}/api/reports`, {
    method: "POST",
    headers: {
      Origin: baseUrl,
      Cookie: cookie,
      "X-Forwarded-For": address,
    },
    body: createReportForm(overrides),
  });
  const payload = (await response.json()) as {
    data?: {
      id?: string;
      incidentId?: string;
      incident?: { id: string; matchedExisting: boolean; contributingReportCount: number };
    };
  };
  return { response, payload };
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

async function startTestServer() {
  const port = await getAvailablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
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
      stdio: "ignore",
    },
  );

  await waitForServer(server, baseUrl);
  return { baseUrl, server };
}

const integrationTest = testDatabaseUrl
  ? test
  : (test as typeof test).skip;

integrationTest(
  "report API enforces ownership, validation, rate limits, and concurrent undo consistency",
  async () => {
    const runId = randomUUID();
    const ownerAddress = `integration-owner-${runId}`;
    const otherAddress = `integration-other-${runId}`;
    const { baseUrl, server } = await startTestServer();

    let reportId = "";
    let ownerCookie = "";

    try {

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

      const forbiddenUpdate = new FormData();
      forbiddenUpdate.set("message", "This update must be rejected.");
      const forbiddenUpdateResponse = await fetch(
        `${baseUrl}/api/reports/${reportId}/updates`,
        {
          method: "POST",
          headers: {
            Origin: baseUrl,
            Cookie: otherCookie,
            "X-Forwarded-For": otherAddress,
          },
          body: forbiddenUpdate,
        },
      );
      assert.equal(forbiddenUpdateResponse.status, 403);

      const ownerUpdate = new FormData();
      ownerUpdate.set("message", "Water level is increasing near the bridge.");
      ownerUpdate.set("severity", "Critical");
      const ownerUpdateResponse = await fetch(
        `${baseUrl}/api/reports/${reportId}/updates`,
        {
          method: "POST",
          headers: {
            Origin: baseUrl,
            Cookie: ownerCookie,
            "X-Forwarded-For": ownerAddress,
          },
          body: ownerUpdate,
        },
      );
      const ownerUpdatePayload = (await ownerUpdateResponse.json()) as {
        data?: { severity?: string; updates?: Array<{ message?: string }> };
      };
      assert.equal(ownerUpdateResponse.status, 200);
      assert.equal(ownerUpdatePayload.data?.severity, "Critical");
      assert.equal(
        ownerUpdatePayload.data?.updates?.some(
          (update) => update.message === "Water level is increasing near the bridge.",
        ),
        true,
      );

      const malformedResponse = await fetch(`${baseUrl}/api/reports`, {
        method: "POST",
        headers: {
          Origin: baseUrl,
          Cookie: ownerCookie,
          "X-Forwarded-For": ownerAddress,
          "Content-Type": "multipart/form-data; boundary=broken",
        },
        body: "not-valid-multipart-data",
      });
      assert.equal(malformedResponse.status, 400);

      const forgedImageForm = createReportForm();
      forgedImageForm.set(
        "image",
        new File(["not a real PNG"], "forged.png", { type: "image/png" }),
      );
      const forgedImageResponse = await fetch(`${baseUrl}/api/reports`, {
        method: "POST",
        headers: {
          Origin: baseUrl,
          Cookie: ownerCookie,
          "X-Forwarded-For": ownerAddress,
        },
        body: forgedImageForm,
      });
      assert.equal(forgedImageResponse.status, 400);

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

      const resolveRequest = (cookie: string, address: string) =>
        fetch(`${baseUrl}/api/reports/${reportId}/resolve`, {
          method: "POST",
          headers: {
            Origin: baseUrl,
            Cookie: cookie,
            "X-Forwarded-For": address,
          },
        });

      assert.equal((await resolveRequest(otherCookie, otherAddress)).status, 200);
      assert.equal((await resolveRequest(thirdCookie, thirdAddress)).status, 200);

      const [firstResolveUndo, secondResolveUndo] = await Promise.all([
        fetch(`${baseUrl}/api/reports/${reportId}/resolve`, {
          method: "DELETE",
          headers: {
            Origin: baseUrl,
            Cookie: otherCookie,
            "X-Forwarded-For": otherAddress,
          },
        }),
        fetch(`${baseUrl}/api/reports/${reportId}/resolve`, {
          method: "DELETE",
          headers: {
            Origin: baseUrl,
            Cookie: thirdCookie,
            "X-Forwarded-For": thirdAddress,
          },
        }),
      ]);
      assert.deepEqual(
        [firstResolveUndo.status, secondResolveUndo.status].sort(),
        [200, 200],
      );

      const reportAfterResolveUndo = await fetch(`${baseUrl}/api/reports/${reportId}`, {
        headers: { Cookie: ownerCookie, "X-Forwarded-For": ownerAddress },
      });
      const reportAfterResolveUndoPayload = (await reportAfterResolveUndo.json()) as {
        data?: { resolvedCount?: number };
      };
      assert.equal(reportAfterResolveUndoPayload.data?.resolvedCount, 0);

      const rateLimitAddress = `integration-rate-limit-${runId}`;
      const rateLimitResponses = await Promise.all(
        Array.from({ length: 11 }, () =>
          fetch(`${baseUrl}/api/report-session`, {
            method: "POST",
            headers: {
              Origin: baseUrl,
              "Content-Type": "application/json",
              "X-Forwarded-For": rateLimitAddress,
            },
            body: "{}",
          }),
        ),
      );
      assert.equal(rateLimitResponses.filter((response) => response.status === 200).length, 10);
      assert.equal(rateLimitResponses.filter((response) => response.status === 429).length, 1);
      assert.ok(
        rateLimitResponses
          .find((response) => response.status === 429)
          ?.headers.get("retry-after"),
      );

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

integrationTest(
  "same-location reports converge on one server-enforced incident under concurrency",
  async () => {
    const runId = randomUUID();
    const { baseUrl, server } = await startTestServer();
    const spotLatitude = "14.700001";
    const spotLongitude = "121.100001";
    const createdReports: Array<{ id: string; cookie: string; address: string }> = [];

    try {
      const sessions = await Promise.all(
        Array.from({ length: 5 }, async (_unused, index) => {
          const address = `integration-concurrency-${runId}-${index}`;
          const cookie = await createSession(baseUrl, address);
          return { address, cookie };
        }),
      );

      const concurrentResults = await Promise.all(
        sessions.map(({ cookie, address }) =>
          submitReport(baseUrl, cookie, address, {
            latitude: spotLatitude,
            longitude: spotLongitude,
            titleSuffix: `concurrent-${runId}`,
          }),
        ),
      );

      concurrentResults.forEach(({ response, payload }, index) => {
        assert.equal(response.status, 201);
        assert.ok(payload.data?.id);
        if (payload.data?.id) {
          createdReports.push({
            id: payload.data.id,
            cookie: sessions[index].cookie,
            address: sessions[index].address,
          });
        }
      });

      const incidentIds = new Set(
        concurrentResults.map((result) => result.payload.data?.incident?.id),
      );
      assert.equal(incidentIds.size, 1, "all concurrent same-spot reports must share one incident");

      const matchedExistingCount = concurrentResults.filter(
        (result) => result.payload.data?.incident?.matchedExisting === true,
      ).length;
      assert.equal(matchedExistingCount, 4, "exactly one of five reports should found the incident");

      const sharedIncidentId = [...incidentIds][0];

      const secondReportFromOwner = await submitReport(
        baseUrl,
        sessions[0].cookie,
        sessions[0].address,
        {
          latitude: spotLatitude,
          longitude: spotLongitude,
          titleSuffix: `same-user-second-${runId}`,
        },
      );
      assert.equal(secondReportFromOwner.response.status, 201);
      assert.equal(secondReportFromOwner.payload.data?.incident?.matchedExisting, true);
      assert.equal(secondReportFromOwner.payload.data?.incident?.id, sharedIncidentId);
      assert.equal(secondReportFromOwner.payload.data?.incident?.contributingReportCount, 6);
      if (secondReportFromOwner.payload.data?.id) {
        createdReports.push({
          id: secondReportFromOwner.payload.data.id,
          cookie: sessions[0].cookie,
          address: sessions[0].address,
        });
      }

      const forcedAddress = `integration-force-new-${runId}`;
      const forcedCookie = await createSession(baseUrl, forcedAddress);
      const forcedResult = await submitReport(baseUrl, forcedCookie, forcedAddress, {
        latitude: spotLatitude,
        longitude: spotLongitude,
        forceNewIncident: true,
        titleSuffix: `forced-separate-${runId}`,
      });
      assert.equal(forcedResult.response.status, 201);
      assert.equal(forcedResult.payload.data?.incident?.matchedExisting, false);
      assert.notEqual(forcedResult.payload.data?.incident?.id, sharedIncidentId);
      if (forcedResult.payload.data?.id) {
        createdReports.push({
          id: forcedResult.payload.data.id,
          cookie: forcedCookie,
          address: forcedAddress,
        });
      }

      const farAddress = `integration-far-away-${runId}`;
      const farCookie = await createSession(baseUrl, farAddress);
      const farResult = await submitReport(baseUrl, farCookie, farAddress, {
        latitude: "14.706000",
        longitude: "121.106000",
        titleSuffix: `far-away-${runId}`,
      });
      assert.equal(farResult.response.status, 201);
      assert.equal(farResult.payload.data?.incident?.matchedExisting, false);
      assert.notEqual(farResult.payload.data?.incident?.id, sharedIncidentId);
      if (farResult.payload.data?.id) {
        createdReports.push({ id: farResult.payload.data.id, cookie: farCookie, address: farAddress });
      }
    } finally {
      await Promise.all(
        createdReports.map(({ id, cookie, address }) =>
          fetch(`${baseUrl}/api/reports/${id}`, {
            method: "DELETE",
            headers: {
              Origin: baseUrl,
              Cookie: cookie,
              "X-Forwarded-For": address,
            },
          }).catch(() => undefined),
        ),
      );
      await stopServer(server);
    }
  },
);
