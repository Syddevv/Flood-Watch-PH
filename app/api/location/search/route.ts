import { unstable_cache } from "next/cache";

import { errorResponse, successResponse } from "@/lib/api-response";
import {
  MAX_WEATHER_QUERY_LENGTH,
  normalizeBoundedText,
} from "@/lib/api-utils";
import { searchPhilippineLocation } from "@/lib/weather";
import { protectApiRequest } from "@/lib/request-security";
import { logApiError } from "@/lib/structured-logger";

const getCachedLocationSearch = unstable_cache(
  async (query: string) => searchPhilippineLocation(query),
  ["location-search-v1"],
  { revalidate: 24 * 60 * 60 },
);

export async function GET(request: Request) {
  try {
    const protectionResponse = await protectApiRequest(request, {
      scope: "location-search",
      limit: 30,
      windowMs: 60 * 1000,
      databaseFailureFallback: "memory",
    });

    if (protectionResponse) {
      return protectionResponse;
    }

    const rawQuery = new URL(request.url).searchParams.get("query");
    const query = normalizeBoundedText(rawQuery, MAX_WEATHER_QUERY_LENGTH);

    if (rawQuery !== null && query === undefined) {
      return errorResponse(
        `Location query must not exceed ${MAX_WEATHER_QUERY_LENGTH} characters.`,
        400,
      );
    }

    if (!query) {
      return errorResponse("Enter a place, city, municipality, or province.", 400);
    }

    const result = await getCachedLocationSearch(query);
    return successResponse(result, {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
      },
    });
  } catch (error) {
    logApiError("location-search-failed", request, error);
    return errorResponse(
      error instanceof Error &&
        error.message === "Location not found. Try another city, municipality, or province."
        ? error.message
        : "Location search is temporarily unavailable. Please try again later.",
      503,
    );
  }
}
