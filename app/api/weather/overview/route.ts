import { errorResponse, successResponse } from "@/lib/api-response";
import { getWeatherOverview } from "@/lib/weather";

export async function GET() {
  try {
    const overview = await getWeatherOverview();
    return successResponse(overview);
  } catch (error) {
    console.error("Failed to fetch weather overview.", error);
    return errorResponse(
      error instanceof Error ? error.message : "Unable to load weather data.",
      503,
    );
  }
}
