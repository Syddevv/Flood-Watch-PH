import { fetchNominatimReverse } from "@/lib/nominatim";

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

const EMPTY_RESULT: ReportReverseGeocodeResult = {
  locationName: null,
  formattedAddress: null,
};

async function reverseGeocodeAtZoom(
  latitude: number,
  longitude: number,
  zoom: number,
): Promise<{ payload: NominatimReverseResponse | null; result: ReportReverseGeocodeResult }> {
  const payload = (await fetchNominatimReverse(
    latitude,
    longitude,
    zoom,
  )) as NominatimReverseResponse | null;

  if (!payload) {
    return { payload: null, result: EMPTY_RESULT };
  }

  const countryCode = payload.address?.country_code?.toUpperCase();

  if (countryCode && countryCode !== PHILIPPINES_COUNTRY_CODE) {
    return { payload, result: EMPTY_RESULT };
  }

  const formattedAddress = formatReportAddress(payload);

  return {
    payload,
    result: { locationName: formattedAddress, formattedAddress },
  };
}

export async function reverseGeocodeReportLocation(
  latitude: number,
  longitude: number,
): Promise<ReportReverseGeocodeResult> {
  try {
    const primary = await reverseGeocodeAtZoom(latitude, longitude, 18);

    if (primary.result.formattedAddress) {
      return primary.result;
    }

    // The precise (building/address-level) lookup got a real response but no
    // usable address (common for flood-prone areas without indexed roads) -
    // retry once at a broader, neighbourhood-level zoom before giving up.
    // Skip the retry on a null payload (timeout/non-OK) since it is unlikely
    // to succeed immediately after and would double the worst-case wait.
    if (!primary.payload) {
      return primary.result;
    }

    const broader = await reverseGeocodeAtZoom(latitude, longitude, 14);

    return broader.result.formattedAddress ? broader.result : primary.result;
  } catch {
    return EMPTY_RESULT;
  }
}
