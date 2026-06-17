import { unstable_cache } from "next/cache";

import { errorResponse, successResponse } from "@/lib/api-response";
import {
  getWeatherCacheHeaders,
  getWeatherSources,
  getWeatherUnavailableMessage,
} from "@/lib/weather";
import { WEATHER_SOURCE_CACHE_SECONDS } from "@/lib/source-metadata";

const getCachedWeatherSources = unstable_cache(getWeatherSources, ["weather-sources"], {
  revalidate: WEATHER_SOURCE_CACHE_SECONDS,
});

export async function GET() {
  try {
    const sources = await getCachedWeatherSources();
    return successResponse(sources, {
      headers: getWeatherCacheHeaders(),
    });
  } catch (error) {
    console.error("Failed to fetch weather sources.", error);
    return errorResponse(
      error instanceof Error ? error.message : getWeatherUnavailableMessage(),
      503,
    );
  }
}
