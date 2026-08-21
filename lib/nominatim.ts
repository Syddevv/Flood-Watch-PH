import { unstable_cache } from "next/cache";

const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";
const NOMINATIM_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;
const NOMINATIM_MIN_INTERVAL_MS = 1000;
const NOMINATIM_REQUEST_TIMEOUT_MS = 15000;

export type NominatimReversePayload = {
  display_name?: string;
  address?: Record<string, string | undefined>;
};

const getCachedNominatimReverse = unstable_cache(
  async (latitude: number, longitude: number, zoom: number) => {
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
          "User-Agent": "FloodWatchPH/1.0 (contact: floodwatchph@example.com)",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        return null;
      }

      return (await response.json()) as NominatimReversePayload;
    } finally {
      clearTimeout(timeoutId);
    }
  },
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
  return getCachedNominatimReverse(latitude, longitude, zoom);
}
