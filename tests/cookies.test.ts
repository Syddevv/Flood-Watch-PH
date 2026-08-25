import assert from "node:assert/strict";
import test from "node:test";

import { buildSessionCookie, getCookieValue } from "@/lib/cookies";

function requestWithCookieHeader(cookieHeader: string | null) {
  const headers = new Headers();
  if (cookieHeader !== null) {
    headers.set("cookie", cookieHeader);
  }
  return new Request("http://localhost/", { headers });
}

test("returns the value of the named cookie", () => {
  const request = requestWithCookieHeader("foo=bar; floodwatch_report_session=abc123");
  assert.equal(getCookieValue(request, "floodwatch_report_session"), "abc123");
});

test("returns an empty string when the cookie header is missing", () => {
  const request = requestWithCookieHeader(null);
  assert.equal(getCookieValue(request, "floodwatch_report_session"), "");
});

test("returns an empty string when the named cookie is absent", () => {
  const request = requestWithCookieHeader("foo=bar");
  assert.equal(getCookieValue(request, "floodwatch_report_session"), "");
});

test("cookie values containing '=' are preserved in full", () => {
  const request = requestWithCookieHeader("session=a.b.c=d");
  assert.equal(getCookieValue(request, "session"), "a.b.c=d");
});

test("builds a Set-Cookie string with the standard attributes", () => {
  const cookie = buildSessionCookie("floodwatch_auth_session", "token123", 2_592_000, false);
  assert.equal(
    cookie,
    "floodwatch_auth_session=token123; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax",
  );
});

test("appends Secure only when requested (production)", () => {
  const cookie = buildSessionCookie("floodwatch_auth_session", "token123", 2_592_000, true);
  assert.equal(
    cookie,
    "floodwatch_auth_session=token123; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax; Secure",
  );
});

test("builds an expired cookie that clears the client-side value", () => {
  const cookie = buildSessionCookie("floodwatch_auth_session", "", 0, false);
  assert.equal(
    cookie,
    "floodwatch_auth_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax",
  );
});
