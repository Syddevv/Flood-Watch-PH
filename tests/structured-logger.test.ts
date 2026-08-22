import assert from "node:assert/strict";
import test from "node:test";

import { getRequestId, withRequestId } from "@/lib/structured-logger";

test("request IDs are read from the propagated request header", () => {
  const request = new Request("http://localhost/api/health", {
    headers: { "x-request-id": "request-123" },
  });
  assert.equal(getRequestId(request), "request-123");
});

test("responses preserve the request correlation ID", () => {
  const request = new Request("http://localhost/api/health", {
    headers: { "x-request-id": "request-123" },
  });
  const response = withRequestId(new Response("ok"), request);
  assert.equal(response.headers.get("x-request-id"), "request-123");
});
