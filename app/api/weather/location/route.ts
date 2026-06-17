import { unstable_cache } from "next/cache";

import { errorResponse, successResponse } from "@/lib/api-response";
import {
  getWeatherByQuery,
  getWeatherCacheHeaders,
  getWeatherUnavailableMessage,
} from "@/lib/weather";
import { WEATHER_SOURCE_CACHE_SECONDS } from "@/lib/source-metadata";

const getCachedWeatherByQuery = unstable_cache(
  async (query: string) => getWeatherByQuery(query),
  ["weather-location-query"],
  {
    revalidate: WEATHER_SOURCE_CACHE_SECONDS,
  },
);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query")?.trim();

    if (query) {
      const result = await getCachedWeatherByQuery(query);
      return successResponse(result, {
        headers: getWeatherCacheHeaders(),
      });
    }

    return errorResponse("Location not found. Try another city, municipality, or province.", 400);
  } catch (error) {
    console.error("Failed to fetch location weather.", error);
    return errorResponse(
      error instanceof Error ? error.message : getWeatherUnavailableMessage(),
      503,
    );
  }
}
