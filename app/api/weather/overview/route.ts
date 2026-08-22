import { unstable_cache } from "next/cache";

import { successResponse } from "@/lib/api-response";
import {
  createUnavailableWeatherOverview,
  getWeatherCacheHeaders,
  getWeatherOverview,
  getWeatherUnavailableMessage,
} from "@/lib/weather";
import { WEATHER_SOURCE_CACHE_SECONDS } from "@/lib/source-metadata";
import { protectApiRequest } from "@/lib/request-security";

const getCachedWeatherOverview = unstable_cache(getWeatherOverview, ["weather-overview"], {
  revalidate: WEATHER_SOURCE_CACHE_SECONDS,
});

export async function GET(request: Request) {
  try {
    const protectionResponse = await protectApiRequest(request, {
      scope: "weather-overview",
      limit: 120,
      windowMs: 60 * 1000,
      databaseFailureFallback: "memory",
    });

    if (protectionResponse) {
      return protectionResponse;
    }

    const overview = await getCachedWeatherOverview();
    return successResponse(overview, {
      headers: getWeatherCacheHeaders(),
    });
  } catch (error) {
    console.error("Failed to fetch weather overview.", error);
    return successResponse(
      createUnavailableWeatherOverview(getWeatherUnavailableMessage()),
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
