import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import {
  cookieFromResponse,
  createReportForm,
  integrationTest,
  startTestServer,
  stopServer,
} from "./test-server";

function uniqueEmail(runId: string, label: string) {
  return `integration-auth-${label}-${runId}@example.com`;
}

async function register(
  baseUrl: string,
  address: string,
  email: string,
  password: string,
) {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: {
      Origin: baseUrl,
      "Content-Type": "application/json",
      "X-Forwarded-For": address,
    },
    body: JSON.stringify({ email, password }),
  });
  const payload = (await response.json()) as {
    data?: { verificationRequired: boolean; email: string };
    error?: string;
  };
  return { response, payload };
}

async function login(baseUrl: string, address: string, email: string, password: string) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      Origin: baseUrl,
      "Content-Type": "application/json",
      "X-Forwarded-For": address,
    },
    body: JSON.stringify({ email, password }),
  });
  const payload = (await response.json()) as {
    data?: { user: { id: string; email: string; role: string } };
    error?: string;
  };
  return { response, payload };
}

integrationTest(
  "registration, login, logout, and the protected report-creation flow",
  async () => {
    const runId = randomUUID();
    const { baseUrl, server } = await startTestServer();
    const address = `integration-auth-${runId}`;
    const email = uniqueEmail(runId, "primary");
    const password = "correct-horse-battery-staple";
    const createdReportIds: Array<{ id: string; cookie: string }> = [];

    try {
      // Unauthenticated report creation is rejected outright.
      const unauthResponse = await fetch(`${baseUrl}/api/reports`, {
        method: "POST",
        headers: { Origin: baseUrl, "X-Forwarded-For": address },
        body: createReportForm({ titleSuffix: "unauth" }),
      });
      assert.equal(unauthResponse.status, 401);

      // Registration creates only a pending account and never a session.
      const registerResult = await register(baseUrl, address, email, password);
      assert.equal(registerResult.response.status, 202);
      assert.equal(registerResult.payload.data?.email, email);
      assert.equal(registerResult.payload.data?.verificationRequired, true);
      assert.equal(JSON.stringify(registerResult.payload).includes("passwordHash"), false);
      assert.equal(registerResult.response.headers.get("set-cookie"), null);

      const pendingLogin = await login(baseUrl, address, email, password);
      assert.equal(pendingLogin.response.status, 403);
      assert.equal(pendingLogin.response.headers.get("set-cookie"), null);

      // Duplicate registration receives the same generic pending response.
      const duplicateResult = await register(baseUrl, address, email, "a-different-password");
      assert.equal(duplicateResult.response.status, 202);
      assert.equal(duplicateResult.payload.data?.verificationRequired, true);

      const verifyResponse = await fetch(`${baseUrl}/api/auth/verify-code`, {
        method: "POST",
        headers: {
          Origin: baseUrl,
          "Content-Type": "application/json",
          "X-Forwarded-For": address,
        },
        body: JSON.stringify({ email, code: "123456" }),
      });
      assert.equal(verifyResponse.status, 200);
      const registerCookie = cookieFromResponse(verifyResponse);

      // Verification issues a session that can submit a protected report.
      const createResponse = await fetch(`${baseUrl}/api/reports`, {
        method: "POST",
        headers: { Origin: baseUrl, Cookie: registerCookie, "X-Forwarded-For": address },
        body: createReportForm({ titleSuffix: "registered" }),
      });
      const createPayload = (await createResponse.json()) as {
        data?: { id: string; isOwner: boolean };
      };
      assert.equal(createResponse.status, 201);
      assert.equal(createPayload.data?.isOwner, true);
      if (createPayload.data?.id) {
        createdReportIds.push({ id: createPayload.data.id, cookie: registerCookie });
      }

      // Wrong password and a nonexistent email both fail with the same
      // generic message, so failure timing/content can't be used to
      // discover which emails are registered.
      const wrongPasswordResult = await login(baseUrl, address, email, "totally-wrong-password");
      assert.equal(wrongPasswordResult.response.status, 401);

      const nonexistentResult = await login(
        baseUrl,
        address,
        uniqueEmail(runId, "nonexistent"),
        "whatever-password-value",
      );
      assert.equal(nonexistentResult.response.status, 401);
      assert.equal(wrongPasswordResult.payload.error, nonexistentResult.payload.error);

      // Correct login succeeds and issues a fresh session cookie.
      const loginResult = await login(baseUrl, address, email, password);
      assert.equal(loginResult.response.status, 200);
      assert.equal(loginResult.payload.data?.user.email, email);
      const loginCookie = cookieFromResponse(loginResult.response);

      const sessionCheck = await fetch(`${baseUrl}/api/auth/session`, {
        headers: { Cookie: loginCookie },
      });
      const sessionPayload = (await sessionCheck.json()) as {
        data?: { user: { email: string } | null };
      };
      assert.equal(sessionPayload.data?.user?.email, email);

      // Logout clears the session server-side.
      const logoutResponse = await fetch(`${baseUrl}/api/auth/logout`, {
        method: "POST",
        headers: { Origin: baseUrl, Cookie: loginCookie, "X-Forwarded-For": address },
      });
      assert.equal(logoutResponse.status, 200);

      const sessionAfterLogout = await fetch(`${baseUrl}/api/auth/session`, {
        headers: { Cookie: loginCookie },
      });
      const sessionAfterLogoutPayload = (await sessionAfterLogout.json()) as {
        data?: { user: unknown };
      };
      assert.equal(sessionAfterLogoutPayload.data?.user, null);

      const postLogoutCreateResponse = await fetch(`${baseUrl}/api/reports`, {
        method: "POST",
        headers: { Origin: baseUrl, Cookie: loginCookie, "X-Forwarded-For": address },
        body: createReportForm({ titleSuffix: "post-logout" }),
      });
      assert.equal(postLogoutCreateResponse.status, 401);
    } finally {
      await Promise.all(
        createdReportIds.map(({ id, cookie }) =>
          fetch(`${baseUrl}/api/reports/${id}`, {
            method: "DELETE",
            headers: { Origin: baseUrl, Cookie: cookie, "X-Forwarded-For": address },
          }).catch(() => undefined),
        ),
      );
      await stopServer(server);
    }
  },
);
