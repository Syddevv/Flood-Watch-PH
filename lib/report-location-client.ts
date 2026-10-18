import { fetchWeatherLocation } from "@/lib/weather-client";

type ReportReverseGeocodeResponse =
  | {
      data: {
        locationName: string | null;
        formattedAddress: string | null;
        localityCode?: string | null;
        barangay?: string | null;
      };
    }
  | {
      error: string;
    };

export type ReportLocationResolution = {
  locationName: string;
  precise: boolean;
  localityCode?: string;
  barangay?: string;
};

async function resolvePreciseLocationName(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<{ locationName: string; localityCode?: string; barangay?: string } | null> {
  try {
    const searchParams = new URLSearchParams({
      lat: String(latitude),
      lng: String(longitude),
    });
    const url = `/api/reports/reverse-geocode?${searchParams.toString()}`;
    const response = await fetch(url, {
      cache: "no-store",
      signal,
    });

    if (response.status === 429) {
      console.warn(
        `Rate limited (429) by ${url}. Retry-After: ${response.headers.get("Retry-After") ?? "unknown"}`,
      );
    }

    const payload = (await response.json()) as ReportReverseGeocodeResponse;

    if (!response.ok || !("data" in payload)) {
      return null;
    }

    const locationName = payload.data.formattedAddress?.trim() || payload.data.locationName?.trim();
    if (!locationName) return null;
    return {
      locationName,
      ...(payload.data.localityCode ? { localityCode: payload.data.localityCode } : {}),
      ...(payload.data.barangay ? { barangay: payload.data.barangay } : {}),
    };
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
    return { ...preciseLocationName, precise: true };
  }

  const result = await fetchWeatherLocation({ lat: latitude, lon: longitude }, signal);
  const approximateLocationName = result.resolvedAddress?.trim();

  if (!approximateLocationName) {
    throw new Error("Reverse-geocoding failed.");
  }

  return { locationName: approximateLocationName, precise: false };
}
