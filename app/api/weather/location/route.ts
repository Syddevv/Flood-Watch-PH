import { errorResponse, successResponse } from "@/lib/api-response";
import { getWeatherByCoordinates, getWeatherByQuery } from "@/lib/weather";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query")?.trim();
    const latitude = searchParams.get("lat");
    const longitude = searchParams.get("lon");
    const name = searchParams.get("name")?.trim();

    if (query) {
      const result = await getWeatherByQuery(query);
      return successResponse(result);
    }

    if (latitude && longitude) {
      const result = await getWeatherByCoordinates(Number(latitude), Number(longitude), name);
      return successResponse(result);
    }

    return errorResponse("Location not found. Try another city, municipality, or province.", 400);
  } catch (error) {
    console.error("Failed to fetch location weather.", error);
    return errorResponse(
      error instanceof Error ? error.message : "Unable to load weather for this location. Please try again.",
      503,
    );
  }
}
