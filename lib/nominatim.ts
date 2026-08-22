import { unstable_cache } from "next/cache";

const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";
const NOMINATIM_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;
const NOMINATIM_MIN_INTERVAL_MS = 1000;
const NOMINATIM_REQUEST_TIMEOUT_MS = 15000;
// Nominatim's usage policy requires a real, reachable contact address in the
// User-Agent. Its edge blocklists the RFC 2606 placeholder domain
// example.com specifically, rejecting every request with a 403.
const NOMINATIM_USER_AGENT = "FloodWatchPH/1.0 (contact: sydbackup08@gmail.com)";

export type NominatimReversePayload = {
  display_name?: string;
  address?: Record<string, string | undefined>;
};

/**
 * Performs the actual Nominatim reverse-geocode request and validates the
 * response. A non-OK response is thrown (never returned as a normal value)
 * so that the `unstable_cache` wrapper around this function can never
 * mistake a failed lookup for a real, cacheable result.
 */
export async function requestNominatimReverse(
  latitude: number,
  longitude: number,
  zoom: number,
): Promise<NominatimReversePayload> {
  const searchParams = new URLSearchParams({
    format: "jsonv2",
    lat: String(latitude),
    lon: String(longitude),
    zoom: String(zoom),
    addressdetails: "1",
    "accept-language": "en",
  });
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NOMINATIM_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${NOMINATIM_REVERSE_URL}?${searchParams.toString()}`, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": NOMINATIM_USER_AGENT,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const bodySnippet = (await response.text().catch(() => "")).slice(0, 200);
      const reason =
        response.status === 429
          ? "Nominatim rate-limited (429)"
          : `Nominatim returned ${response.status}`;
      const message = `${reason}: ${bodySnippet}`;
      console.error(message);
      throw new Error(message);
    }

    return (await response.json()) as NominatimReversePayload;
  } finally {
    clearTimeout(timeoutId);
  }
}

const getCachedNominatimReverse = unstable_cache(
  requestNominatimReverse,
  ["nominatim-reverse"],
  { revalidate: NOMINATIM_CACHE_TTL_SECONDS },
);

let nextNominatimRequestAt = 0;
let nominatimQueue: Promise<void> = Promise.resolve();

async function reserveNominatimSlot() {
  let release!: () => void;
  const previous = nominatimQueue;
  nominatimQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;

  const waitMs = Math.max(0, nextNominatimRequestAt - Date.now());
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  nextNominatimRequestAt = Date.now() + NOMINATIM_MIN_INTERVAL_MS;
  release();
}

export async function fetchNominatimReverse(
  latitude: number,
  longitude: number,
  zoom: number,
): Promise<NominatimReversePayload | null> {
  await reserveNominatimSlot();

  try {
    return await getCachedNominatimReverse(latitude, longitude, zoom);
  } catch {
    return null;
  }
}
