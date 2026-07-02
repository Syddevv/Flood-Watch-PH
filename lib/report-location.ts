const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";
const REQUEST_TIMEOUT_MS = 8000;
const PHILIPPINES_COUNTRY_CODE = "PH";

type NominatimAddress = {
  road?: string;
  pedestrian?: string;
  footway?: string;
  cycleway?: string;
  highway?: string;
  residential?: string;
  path?: string;
  neighbourhood?: string;
  suburb?: string;
  quarter?: string;
  city_district?: string;
  district?: string;
  village?: string;
  hamlet?: string;
  barangay?: string;
  city?: string;
  town?: string;
  municipality?: string;
  county?: string;
  province?: string;
  state?: string;
  region?: string;
  country?: string;
  country_code?: string;
};

type NominatimReverseResponse = {
  display_name?: string;
  address?: NominatimAddress;
};

export type ReportReverseGeocodeResult = {
  locationName: string | null;
  formattedAddress: string | null;
};

function createAbortSignal(timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeoutId),
  };
}

function appendUnique(parts: string[], value: string | null | undefined) {
  const normalized = value?.trim();

  if (!normalized) {
    return;
  }

  const duplicate = parts.some((part) => part.toLowerCase() === normalized.toLowerCase());

  if (!duplicate) {
    parts.push(normalized);
  }
}

function formatReportAddress(payload: NominatimReverseResponse) {
  const address = payload.address;

  if (!address) {
    return payload.display_name?.split(",").slice(0, 4).join(",").trim() || null;
  }

  const parts: string[] = [];

  appendUnique(
    parts,
    address.road ||
      address.highway ||
      address.pedestrian ||
      address.residential ||
      address.footway ||
      address.cycleway ||
      address.path,
  );
  appendUnique(
    parts,
    address.barangay ||
      address.village ||
      address.suburb ||
      address.city_district ||
      address.district ||
      address.neighbourhood ||
      address.quarter ||
      address.hamlet,
  );
  appendUnique(parts, address.municipality || address.city || address.town || address.county);
  appendUnique(parts, address.province || address.state || address.region);

  if (parts.length < 2) {
    appendUnique(parts, address.country);
  }

  if (parts.length > 0) {
    return parts.join(", ");
  }

  return payload.display_name?.split(",").slice(0, 4).join(",").trim() || null;
}

export async function reverseGeocodeReportLocation(
  latitude: number,
  longitude: number,
): Promise<ReportReverseGeocodeResult> {
  const searchParams = new URLSearchParams({
    format: "jsonv2",
    lat: String(latitude),
    lon: String(longitude),
    zoom: "18",
    addressdetails: "1",
    "accept-language": "en",
  });
  const { signal, clear } = createAbortSignal(REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${NOMINATIM_REVERSE_URL}?${searchParams.toString()}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "FloodWatchPH/1.0",
      },
      signal,
    });

    if (!response.ok) {
      return {
        locationName: null,
        formattedAddress: null,
      };
    }

    const payload = (await response.json()) as NominatimReverseResponse;
    const countryCode = payload.address?.country_code?.toUpperCase();

    if (countryCode && countryCode !== PHILIPPINES_COUNTRY_CODE) {
      return {
        locationName: null,
        formattedAddress: null,
      };
    }

    const formattedAddress = formatReportAddress(payload);

    return {
      locationName: formattedAddress,
      formattedAddress,
    };
  } catch {
    return {
      locationName: null,
      formattedAddress: null,
    };
  } finally {
    clear();
  }
}
