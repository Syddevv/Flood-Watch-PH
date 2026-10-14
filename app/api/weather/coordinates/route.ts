import { unstable_cache } from "next/cache";

import { errorResponse, successResponse } from "@/lib/api-response";
import {
  MAX_WEATHER_LOCATION_NAME_LENGTH,
  normalizeBoundedText,
  roundWeatherCoordinate,
} from "@/lib/api-utils";
import { protectApiRequest } from "@/lib/request-security";
import { logApiError } from "@/lib/structured-logger";
import { WEATHER_LOCATION_CACHE_SECONDS } from "@/lib/source-metadata";
import { BULACAN_SCOPE_VERSION, isWithinBulacan } from "@/lib/bulacan-scope";
import { isValidLatitude, isValidLongitude } from "@/lib/validations";
import {
  getWeatherByCoordinates,
  getWeatherCacheHeaders,
  OUTSIDE_WEATHER_SCOPE_MESSAGE,
} from "@/lib/weather";
import { weatherProviderErrorResponse } from "@/lib/weather-api";

const getCachedWeatherByCoordinates = unstable_cache(
  async (latitude: number, longitude: number, name?: string) =>
    getWeatherByCoordinates(latitude, longitude, name),
  ["weather-location-coordinates", BULACAN_SCOPE_VERSION],
  {
    revalidate: WEATHER_LOCATION_CACHE_SECONDS,
  },
);

export async function GET(request: Request) {
  try {
    const protectionResponse = await protectApiRequest(request, {
      scope: "weather-coordinates",
      limit: 30,
      windowMs: 60 * 1000,
      databaseFailureFallback: "memory",
    });

    if (protectionResponse) {
      return protectionResponse;
    }

    const { searchParams } = new URL(request.url);
    const rawLatitude = searchParams.get("lat");
    const rawLongitude = searchParams.get("lng") ?? searchParams.get("lon");
    const latitude = Number(rawLatitude);
    const longitude = Number(rawLongitude);
    const rawName = searchParams.get("name");
    const name = normalizeBoundedText(rawName, MAX_WEATHER_LOCATION_NAME_LENGTH);

    if (
      !rawLatitude?.trim() ||
      !rawLongitude?.trim() ||
      !isValidLatitude(latitude) ||
      !isValidLongitude(longitude)
    ) {
      return errorResponse(
        "Location not found. Try another city, municipality, or province.",
        400,
      );
    }

    if (rawName !== null && name === undefined) {
      return errorResponse(
        `Location name must not exceed ${MAX_WEATHER_LOCATION_NAME_LENGTH} characters.`,
        400,
      );
    }

    if (!isWithinBulacan(latitude, longitude)) {
      return errorResponse(OUTSIDE_WEATHER_SCOPE_MESSAGE, 400);
    }

    // Only cache (with a long TTL, and a cacheable CDN response) the
    // deterministic case where `name` is provided by the caller - there is
    // no reverse-geocode ambiguity/failure risk there. When `name` is
    // omitted, `getWeatherByCoordinates` attempts reverse geocoding
    // internally and, on a transient Nominatim failure, still resolves
    // normally with a degraded coordinate-label fallback name (it does not
    // throw). Routing that through the long-TTL cache would pin a single
    // blip to "no real name" for the full TTL, and a shared CDN cache would
    // do the same for every visitor. This is a personal, per-user "my
    // location" ping, not a shared page load, so fetch it directly and
    // uncached, and tell the CDN not to cache it either.
    const roundedLatitude = roundWeatherCoordinate(latitude);
    const roundedLongitude = roundWeatherCoordinate(longitude);
    const roundedInScope = isWithinBulacan(roundedLatitude, roundedLongitude);
    const cacheLatitude = roundedInScope ? roundedLatitude : latitude;
    const cacheLongitude = roundedInScope ? roundedLongitude : longitude;
    const result = name
      ? await getCachedWeatherByCoordinates(cacheLatitude, cacheLongitude, name)
      : await getWeatherByCoordinates(latitude, longitude);

    return successResponse(result, {
      headers: name ? getWeatherCacheHeaders(WEATHER_LOCATION_CACHE_SECONDS) : { "Cache-Control": "no-store" },
    });
  } catch (error) {
    logApiError("weather-coordinates-failed", request, error);
    return weatherProviderErrorResponse();
  }
}
