import { unstable_cache } from "next/cache";

import { errorResponse, successResponse } from "@/lib/api-response";
import {
  MAX_WEATHER_LOCATION_NAME_LENGTH,
  normalizeBoundedText,
  roundWeatherCoordinate,
} from "@/lib/api-utils";
import { protectApiRequest } from "@/lib/request-security";
import { WEATHER_SOURCE_CACHE_SECONDS } from "@/lib/source-metadata";
import { isValidLatitude, isValidLongitude } from "@/lib/validations";
import {
  getWeatherByCoordinates,
  getWeatherCacheHeaders,
} from "@/lib/weather";
import { weatherProviderErrorResponse } from "@/lib/weather-api";

const getCachedWeatherByCoordinates = unstable_cache(
  async (latitude: number, longitude: number, name?: string) =>
    getWeatherByCoordinates(latitude, longitude, name),
  ["weather-location-coordinates"],
  {
    revalidate: WEATHER_SOURCE_CACHE_SECONDS,
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

    const result = await getCachedWeatherByCoordinates(
      roundWeatherCoordinate(latitude),
      roundWeatherCoordinate(longitude),
      name,
    );

    return successResponse(result, {
      headers: getWeatherCacheHeaders(),
    });
  } catch (error) {
    console.error("Failed to fetch coordinate weather.", error);
    return weatherProviderErrorResponse();
  }
}
