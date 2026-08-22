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
    set: async () => undefined,
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
  t.mock.method(console, "error", () => undefined);
  t.mock.method(globalThis, "fetch", async () => new Response("Access denied.", { status: 403 }));

  await assert.rejects(() => requestNominatimReverse(14.65, 121.1, 18), /returned 403/);
});

test("requestNominatimReverse logs a distinct message for 429 responses, before throwing", async (t) => {
  const errorCalls: unknown[][] = [];
  t.mock.method(console, "error", (...args: unknown[]) => {
    errorCalls.push(args);
  });
  t.mock.method(globalThis, "fetch", async () => new Response("Slow down.", { status: 429 }));

  await assert.rejects(() => requestNominatimReverse(14.65, 121.1, 18), /rate-limited \(429\)/);

  assert.equal(errorCalls.length, 1);
  assert.match(String(errorCalls[0][0]), /rate-limited \(429\)/i);
  assert.match(String(errorCalls[0][0]), /Slow down\./);
});

test("fetchNominatimReverse resolves to null (not a rejected promise) when the underlying request is non-OK", async (t) => {
  t.mock.method(console, "error", () => undefined);
  t.mock.method(globalThis, "fetch", async () => new Response("Access denied.", { status: 403 }));

  const result = await fetchNominatimReverse(14.65, 121.1, 18);

  assert.equal(result, null);
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

  const result = await fetchNominatimReverse(14.65, 121.1, 18);

  assert.deepEqual(result, {
    display_name: "Marcos Highway, Marikina, Metro Manila, Philippines",
    address: { road: "Marcos Highway", city: "Marikina", country_code: "ph" },
  });

  const userAgent = sentHeaders?.get("User-Agent") ?? "";
  assert.doesNotMatch(userAgent, /example\.com/);
  assert.match(userAgent, /sydbackup08@gmail\.com/);
});
