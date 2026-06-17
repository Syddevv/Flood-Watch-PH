import { unstable_cache } from "next/cache";

import { errorResponse, successResponse } from "@/lib/api-response";
import {
  getWeatherByCoordinates,
  getWeatherCacheHeaders,
  getWeatherUnavailableMessage,
} from "@/lib/weather";
import { WEATHER_SOURCE_CACHE_SECONDS } from "@/lib/source-metadata";

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
    const { searchParams } = new URL(request.url);
    const latitude = searchParams.get("lat");
    const longitude = searchParams.get("lng") ?? searchParams.get("lon");
    const name = searchParams.get("name")?.trim();

    if (!latitude || !longitude) {
      return errorResponse("Location not found. Try another city, municipality, or province.", 400);
    }

    const result = await getCachedWeatherByCoordinates(Number(latitude), Number(longitude), name);

    return successResponse(result, {
      headers: getWeatherCacheHeaders(),
    });
  } catch (error) {
    console.error("Failed to fetch coordinate weather.", error);
    return errorResponse(
      error instanceof Error ? error.message : getWeatherUnavailableMessage(),
      503,
    );
  }
}
