import { fetchWeatherLocation } from "@/lib/weather-client";

type ReportReverseGeocodeResponse =
  | {
      data: {
        locationName: string | null;
        formattedAddress: string | null;
      };
    }
  | {
      error: string;
    };

export type ReportLocationResolution = {
  locationName: string;
  precise: boolean;
};

async function resolvePreciseLocationName(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const searchParams = new URLSearchParams({
      lat: String(latitude),
      lng: String(longitude),
    });
    const response = await fetch(`/api/reports/reverse-geocode?${searchParams.toString()}`, {
      cache: "no-store",
      signal,
    });
    const payload = (await response.json()) as ReportReverseGeocodeResponse;

    if (!response.ok || !("data" in payload)) {
      return null;
    }

    return payload.data.formattedAddress?.trim() || payload.data.locationName?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Resolves a display name for report-related coordinates, preferring the
 * precise (road/barangay-level) report geocoder and falling back to the
 * broader weather-domain geocoder. Throws if both tiers fail to resolve a
 * real name so callers can supply their own fallback / error messaging.
 */
export async function resolveReportLocationName(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<ReportLocationResolution> {
  const preciseLocationName = await resolvePreciseLocationName(latitude, longitude, signal);

  if (preciseLocationName) {
    return { locationName: preciseLocationName, precise: true };
  }

  const result = await fetchWeatherLocation({ lat: latitude, lon: longitude }, signal);
  const approximateLocationName = result.resolvedAddress?.trim();

  if (!approximateLocationName) {
    throw new Error("Reverse-geocoding failed.");
  }

  return { locationName: approximateLocationName, precise: false };
}
