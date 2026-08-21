import { unstable_cache } from "next/cache";

import { errorResponse, successResponse } from "@/lib/api-response";
import {
  getWeatherCacheHeaders,
  getWeatherSources,
  getWeatherUnavailableMessage,
} from "@/lib/weather";
import { WEATHER_SOURCE_CACHE_SECONDS } from "@/lib/source-metadata";
import { protectApiRequest } from "@/lib/request-security";

const getCachedWeatherSources = unstable_cache(getWeatherSources, ["weather-sources"], {
  revalidate: WEATHER_SOURCE_CACHE_SECONDS,
});

export async function GET(request: Request) {
  try {
    const protectionResponse = await protectApiRequest(request, {
      scope: "weather-sources",
      limit: 120,
      windowMs: 60 * 1000,
      databaseFailureFallback: "memory",
    });

    if (protectionResponse) {
      return protectionResponse;
    }

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
