import assert from "node:assert/strict";
import test, { before } from "node:test";
import { AsyncLocalStorage } from "node:async_hooks";

// `fetchNominatimReverse` calls through `unstable_cache`, which needs a
// Next.js request/cache context to run. Outside of the Next.js server
// runtime (as in this plain `node:test` process) it throws an invariant
// error unless `globalThis.AsyncLocalStorage` and a minimal
// `globalThis.__incrementalCache` are present before `lib/nominatim.ts` is
// first loaded. Providing stand-ins here (always a cache miss, never
// persisting anything) lets the real caching wrapper run end-to-end, so
// these tests exercise the actual exported `fetchNominatimReverse` contract
// instead of a hand-mocked stand-in for it.
let requestNominatimReverse: typeof import("@/lib/nominatim").requestNominatimReverse;
let fetchNominatimReverse: typeof import("@/lib/nominatim").fetchNominatimReverse;

// Records every call to the cache shim's `set`, so tests can assert on the
// actual number of cache writes rather than only on the resolved/rejected
// value. This is what would catch a regression that reintroduces caching a
// failed lookup (e.g. `return null` inside the cached callback instead of
// throwing).
const cacheSetCalls: unknown[][] = [];

before(async () => {
  const globalWithHooks = globalThis as typeof globalThis & {
    AsyncLocalStorage?: typeof AsyncLocalStorage;
    __incrementalCache?: unknown;
  };

  globalWithHooks.AsyncLocalStorage ??= AsyncLocalStorage;
  globalWithHooks.__incrementalCache ??= {
    isOnDemandRevalidate: false,
    generateCacheKey: async (key: string) => key,
    get: async () => undefined,
    set: async (...args: unknown[]) => {
      cacheSetCalls.push(args);
    },
  };

  ({ requestNominatimReverse, fetchNominatimReverse } = await import("@/lib/nominatim"));
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("requestNominatimReverse throws (rather than returning null) when Nominatim responds 403", async (t) => {
  const errorCalls: unknown[][] = [];
  t.mock.method(console, "error", (...args: unknown[]) => {
    errorCalls.push(args);
  });
  t.mock.method(globalThis, "fetch", async () => new Response("Access denied.", { status: 403 }));

  await assert.rejects(() => requestNominatimReverse(14.65, 121.1, 18), /returned 403/);
  // requestNominatimReverse itself must not log: fetchNominatimReverse's
  // outer catch is the single place failures are logged, so logging here
  // too would double-log the HTTP-status case.
  assert.equal(errorCalls.length, 0);
});

test("requestNominatimReverse throws a distinct, JSON-escaped message for 429 responses", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("Slow down.\nRetry later.", { status: 429 }));

  await assert.rejects(
    () => requestNominatimReverse(14.65, 121.1, 18),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /rate-limited \(429\)/i);
      // The untrusted response body must be JSON-escaped (e.g. embedded
      // newlines turned into `\n`) so it can't forge extra log lines.
      assert.match(error.message, /"Slow down\.\\nRetry later\."/);
      assert.doesNotMatch(error.message, /Slow down\.\nRetry later\./);
      return true;
    },
  );
});

test("fetchNominatimReverse logs exactly once, with coordinate/zoom context, when the request fails", async (t) => {
  const errorCalls: unknown[][] = [];
  t.mock.method(console, "error", (...args: unknown[]) => {
    errorCalls.push(args);
  });
  t.mock.method(globalThis, "fetch", async () => new Response("Access denied.", { status: 403 }));

  const result = await fetchNominatimReverse(14.65, 121.1, 18);

  assert.equal(result, null);
  assert.equal(errorCalls.length, 1, "expected exactly one console.error call (no double-logging)");
  assert.match(String(errorCalls[0][0]), /Nominatim reverse geocode failed/i);
  const context = errorCalls[0][1] as Record<string, unknown>;
  assert.equal(context.latitude, 14.65);
  assert.equal(context.longitude, 121.1);
  assert.equal(context.zoom, 18);
  assert.ok(context.error instanceof Error);
});

test("fetchNominatimReverse resolves to null (not a rejected promise) when the underlying request is non-OK", async (t) => {
  t.mock.method(console, "error", () => undefined);
  t.mock.method(globalThis, "fetch", async () => new Response("Access denied.", { status: 403 }));

  cacheSetCalls.length = 0;
  const result = await fetchNominatimReverse(14.65, 121.1, 18);

  assert.equal(result, null);
  assert.equal(
    cacheSetCalls.length,
    0,
    "a non-OK response must never be written to the cache",
  );
});

test("fetchNominatimReverse resolves with the parsed payload for a successful response, using a non-example.com contact", async (t) => {
  let sentHeaders: Headers | undefined;
  t.mock.method(globalThis, "fetch", async (_input: string | URL, init?: RequestInit) => {
    sentHeaders = new Headers(init?.headers);
    return jsonResponse({
      display_name: "Marcos Highway, Marikina, Metro Manila, Philippines",
      address: { road: "Marcos Highway", city: "Marikina", country_code: "ph" },
    });
  });

  cacheSetCalls.length = 0;
  const result = await fetchNominatimReverse(14.65, 121.1, 18);

  assert.deepEqual(result, {
    display_name: "Marcos Highway, Marikina, Metro Manila, Philippines",
    address: { road: "Marcos Highway", city: "Marikina", country_code: "ph" },
  });
  assert.equal(
    cacheSetCalls.length,
    1,
    "a successful response must be written to the cache exactly once",
  );

  const userAgent = sentHeaders?.get("User-Agent") ?? "";
  assert.doesNotMatch(userAgent, /example\.com/);
  assert.match(userAgent, /contact: \S+@\S+\.\S+/);
});
