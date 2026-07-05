import { unstable_cache } from "next/cache";

import { successResponse } from "@/lib/api-response";
import {
  createUnavailableWeatherOverview,
  getWeatherCacheHeaders,
  getWeatherOverview,
  getWeatherUnavailableMessage,
} from "@/lib/weather";
import { WEATHER_SOURCE_CACHE_SECONDS } from "@/lib/source-metadata";

const getCachedWeatherOverview = unstable_cache(getWeatherOverview, ["weather-overview"], {
  revalidate: WEATHER_SOURCE_CACHE_SECONDS,
});

export async function GET() {
  try {
    const overview = await getCachedWeatherOverview();
    return successResponse(overview, {
      headers: getWeatherCacheHeaders(),
    });
  } catch {
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
