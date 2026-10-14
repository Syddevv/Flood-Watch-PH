import { unstable_cache } from "next/cache";

import { errorResponse, successResponse } from "@/lib/api-response";
import {
  MAX_WEATHER_QUERY_LENGTH,
  normalizeBoundedText,
} from "@/lib/api-utils";
import {
  getWeatherByQuery,
  getWeatherCacheHeaders,
  WeatherScopeError,
} from "@/lib/weather";
import { weatherProviderErrorResponse } from "@/lib/weather-api";
import { WEATHER_LOCATION_CACHE_SECONDS } from "@/lib/source-metadata";
import { BULACAN_SCOPE_VERSION } from "@/lib/bulacan-scope";
import { protectApiRequest } from "@/lib/request-security";
import { logApiError } from "@/lib/structured-logger";

const getCachedWeatherByQuery = unstable_cache(
  async (query: string) => getWeatherByQuery(query),
  ["weather-location-query", BULACAN_SCOPE_VERSION],
  {
    revalidate: WEATHER_LOCATION_CACHE_SECONDS,
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
        headers: getWeatherCacheHeaders(WEATHER_LOCATION_CACHE_SECONDS),
      });
    }

    return errorResponse("Location not found in Bulacan. Try another Bulacan city or municipality.", 400);
  } catch (error) {
    if (error instanceof WeatherScopeError) {
      return errorResponse(error.message, 400);
    }
    logApiError("weather-location-failed", request, error);
    return weatherProviderErrorResponse();
  }
}
