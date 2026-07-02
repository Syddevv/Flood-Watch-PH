import { errorResponse, successResponse } from "@/lib/api-response";
import { reverseGeocodeReportLocation } from "@/lib/report-location";
import { isValidLatitude, isValidLongitude } from "@/lib/validations";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const latitude = Number(searchParams.get("lat"));
    const longitude = Number(searchParams.get("lng") ?? searchParams.get("lon"));

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      !isValidLatitude(latitude) ||
      !isValidLongitude(longitude)
    ) {
      return errorResponse("Latitude and longitude are required.", 400);
    }

    const result = await reverseGeocodeReportLocation(latitude, longitude);

    if (!result.locationName && !result.formattedAddress) {
      return errorResponse("Reverse-geocoding failed.", 502);
    }

    return successResponse(result, {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=900",
      },
    });
  } catch (error) {
    console.error("Failed to reverse-geocode report location.", error);
    return errorResponse("Reverse-geocoding failed.", 502);
  }
}
