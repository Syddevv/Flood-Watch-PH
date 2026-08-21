import { unstable_cache } from "next/cache";

import { errorResponse, successResponse } from "@/lib/api-response";
import {
  MAX_WEATHER_QUERY_LENGTH,
  normalizeBoundedText,
} from "@/lib/api-utils";
import {
  getWeatherByQuery,
  getWeatherCacheHeaders,
  getWeatherUnavailableMessage,
} from "@/lib/weather";
import { WEATHER_SOURCE_CACHE_SECONDS } from "@/lib/source-metadata";
import { protectApiRequest } from "@/lib/request-security";

const getCachedWeatherByQuery = unstable_cache(
  async (query: string) => getWeatherByQuery(query),
  ["weather-location-query"],
  {
    revalidate: WEATHER_SOURCE_CACHE_SECONDS,
  },
);

export async function GET(request: Request) {
  try {
    const protectionResponse = await protectApiRequest(request, {
      scope: "weather-location",
      limit: 30,
      windowMs: 60 * 1000,
      databaseFailureFallback: "memory",
    });

    if (protectionResponse) {
      return protectionResponse;
    }

    const { searchParams } = new URL(request.url);
    const rawQuery = searchParams.get("query");
    const query = normalizeBoundedText(rawQuery, MAX_WEATHER_QUERY_LENGTH);

    if (rawQuery !== null && query === undefined) {
      return errorResponse(
        `Location query must not exceed ${MAX_WEATHER_QUERY_LENGTH} characters.`,
        400,
      );
    }

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
