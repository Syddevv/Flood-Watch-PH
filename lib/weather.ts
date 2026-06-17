import type {
  AlertSeverity,
  FloodAlert,
  FloodRiskLevel,
  OfficialSourceMetadata,
  WeatherLocation,
  WeatherLocationResult,
  WeatherOverviewData,
  WeatherSourcesData,
} from "@/lib/types";
import {
  SOURCE_LABELS,
  WEATHER_RISK_DISCLAIMER,
  WEATHER_SOURCE_CACHE_SECONDS,
  getPagasaOfficialReference,
  getWeatherDataSource,
  getWeatherSourcesData,
} from "@/lib/source-metadata";

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const OPEN_METEO_GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";
const WEATHER_TIME_ZONE = "Asia/Manila";
const REQUEST_TIMEOUT_MS = 8000;
const PHILIPPINES_COUNTRY_CODE = "PH";
const SIDEBAR_LOCATION_LIMIT = 5;

const MONITORED_LOCATIONS = [
  { name: "Metro Manila", latitude: 14.6091, longitude: 121.0223 },
  { name: "Marikina", latitude: 14.6507, longitude: 121.1029 },
  { name: "Quezon City", latitude: 14.676, longitude: 121.0437 },
  { name: "Manila", latitude: 14.5995, longitude: 120.9842 },
  { name: "Pasig", latitude: 14.5764, longitude: 121.0851 },
  { name: "Cainta", latitude: 14.5786, longitude: 121.1222 },
  { name: "Bulacan", latitude: 14.8441, longitude: 120.8107 },
] as const;

type OpenMeteoResponse = {
  current?: {
    time?: string;
    temperature_2m?: number;
    relative_humidity_2m?: number;
    precipitation?: number;
    weather_code?: number;
    wind_speed_10m?: number;
  };
  hourly?: {
    time?: string[];
    precipitation?: Array<number | null>;
    rain?: Array<number | null>;
    showers?: Array<number | null>;
  };
};

type WeatherLookupLocation = {
  name: string;
  latitude: number;
  longitude: number;
};

type GeocodingSearchResponse = {
  results?: GeocodingResult[];
};

type GeocodingResult = {
  name: string;
  latitude: number;
  longitude: number;
  feature_code?: string;
  country_code?: string;
  admin1?: string;
  admin2?: string;
  admin3?: string;
  admin4?: string;
  population?: number;
};

type ReverseGeocodingResponse = {
  address?: {
    city?: string;
    town?: string;
    municipality?: string;
    village?: string;
    suburb?: string;
    county?: string;
    state?: string;
    country_code?: string;
  };
  display_name?: string;
};

const LOCATION_NOT_FOUND_MESSAGE =
  "Location not found. Try another city, municipality, or province.";
const GENERIC_LOCATION_ERROR_MESSAGE =
  "Unable to load weather for this location. Please try again.";
const WEATHER_UNAVAILABLE_MESSAGE =
  "Weather data is temporarily unavailable. Please check PAGASA or try again later.";
const STRIP_PHRASES = [
  "philippines",
  "province of",
  "metro manila",
  "national capital region",
] as const;
const CONTEXT_WORDS = [
  "bulacan",
  "rizal",
  "laguna",
  "cavite",
  "batangas",
  "quezon",
  "cebu",
  "davao",
  "benguet",
  "pampanga",
  "pangasinan",
  "nueva ecija",
  "tarlac",
  "zambales",
  "palawan",
  "iloilo",
  "negros occidental",
  "negros oriental",
  "misamis oriental",
  "misamis occidental",
  "south cotabato",
  "north cotabato",
  "cotabato",
  "camarines sur",
  "camarines norte",
  "surigao del norte",
  "surigao del sur",
  "agusan del norte",
  "agusan del sur",
  "la union",
  "ifugao",
  "abra",
  "apayao",
  "aurora",
  "albay",
  "sorsogon",
  "leyte",
  "southern leyte",
  "eastern samar",
  "western samar",
  "northern samar",
  "province",
  "city",
  "municipality",
  "barangay",
] as const;

function createAbortSignal(timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeoutId),
  };
}

function mapWeatherCodeToCondition(weatherCode: number | undefined) {
  switch (weatherCode) {
    case 0:
      return "Clear sky";
    case 1:
      return "Mainly clear";
    case 2:
      return "Partly cloudy";
    case 3:
      return "Overcast";
    case 45:
    case 48:
      return "Fog";
    case 51:
    case 53:
    case 55:
      return "Drizzle";
    case 56:
    case 57:
      return "Freezing drizzle";
    case 61:
    case 63:
    case 65:
      return "Rain";
    case 66:
    case 67:
      return "Freezing rain";
    case 71:
    case 73:
    case 75:
      return "Snow fall";
    case 77:
      return "Snow grains";
    case 80:
    case 81:
    case 82:
      return "Rain showers";
    case 85:
    case 86:
      return "Snow showers";
    case 95:
      return "Thunderstorm";
    case 96:
    case 99:
      return "Thunderstorm with hail";
    default:
      return "Weather conditions unavailable";
  }
}

function getRiskLevel(
  precipitation: number | null,
  forecastPeak: number | null,
  condition: string | null,
): FloodRiskLevel {
  const baseline = Math.max(precipitation ?? 0, forecastPeak ?? 0);
  const severeCondition =
    condition === "Thunderstorm" || condition === "Thunderstorm with hail";

  if (baseline < 2 && !severeCondition) {
    return "Low";
  }

  if (baseline < 7.5 && !severeCondition) {
    return "Moderate";
  }

  if (baseline < 15 && !severeCondition) {
    return "High";
  }

  return "Critical";
}

function getSeverityFromRiskLevel(riskLevel: FloodRiskLevel): AlertSeverity {
  if (riskLevel === "Critical") {
    return "severe";
  }

  if (riskLevel === "High") {
    return "high";
  }

  if (riskLevel === "Moderate") {
    return "moderate";
  }

  return "safe";
}

function getRiskPriority(riskLevel: FloodRiskLevel) {
  if (riskLevel === "Critical") {
    return 0;
  }

  if (riskLevel === "High") {
    return 1;
  }

  if (riskLevel === "Moderate") {
    return 2;
  }

  return 3;
}

function formatWeatherTimestamp(dateString: string | undefined) {
  if (!dateString) {
    return "Time unavailable";
  }

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "Time unavailable";
  }

  return new Intl.DateTimeFormat("en-PH", {
    timeZone: WEATHER_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function isWithinPhilippines(latitude: number, longitude: number) {
  return latitude >= 4 && latitude <= 22.5 && longitude >= 116 && longitude <= 127.5;
}

function buildDisplayLocationName(result: GeocodingResult) {
  const adminParts = [result.admin4, result.admin3, result.admin2, result.admin1].filter(
    (part, index, items): part is string =>
      typeof part === "string" &&
      part.trim().length > 0 &&
      items.indexOf(part) === index &&
      part !== result.name,
  );

  return [result.name, ...adminParts.slice(0, 2)].join(", ");
}

function normalizeLocationQuery(query: string) {
  return query
    .toLowerCase()
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeAttempts(attempts: string[]) {
  return attempts.filter(
    (attempt, index, items) => attempt.length >= 2 && items.indexOf(attempt) === index,
  );
}

function stripKnownPhrases(query: string) {
  return STRIP_PHRASES.reduce(
    (currentQuery, phrase) =>
      currentQuery.replace(new RegExp(`\\b${phrase.replace(/\s+/g, "\\s+")}\\b`, "gi"), " "),
    query,
  )
    .replace(/\s+/g, " ")
    .trim();
}

function removeTrailingContextWords(query: string) {
  let nextQuery = query;

  for (const contextWord of CONTEXT_WORDS) {
    const trailingPattern = new RegExp(`\\b${contextWord.replace(/\s+/g, "\\s+")}$`, "i");

    if (trailingPattern.test(nextQuery)) {
      nextQuery = nextQuery.replace(trailingPattern, "").trim();
    }
  }

  return nextQuery.replace(/\s+/g, " ").trim();
}

function buildLocationSearchAttempts(query: string) {
  const attempts: string[] = [];
  const normalizedQuery = normalizeLocationQuery(query);
  const strippedQuery = stripKnownPhrases(normalizedQuery);
  const withoutTrailingContext = removeTrailingContextWords(strippedQuery);
  const words = withoutTrailingContext.split(" ").filter(Boolean);

  attempts.push(normalizedQuery);

  if (strippedQuery && strippedQuery !== normalizedQuery) {
    attempts.push(strippedQuery);
  }

  if (withoutTrailingContext && withoutTrailingContext !== strippedQuery) {
    attempts.push(withoutTrailingContext);
  }

  if (words.length >= 2) {
    attempts.push(words.slice(0, 2).join(" "));
  }

  if (words.length >= 1) {
    attempts.push(words[0]);
  }

  return dedupeAttempts(attempts);
}

function scorePhilippineResult(result: GeocodingResult, query: string) {
  const normalizedQuery = normalizeLocationQuery(query);
  const resultName = normalizeLocationQuery(result.name);
  const admin1 = normalizeLocationQuery(result.admin1 ?? "");
  const admin2 = normalizeLocationQuery(result.admin2 ?? "");
  const displayName = normalizeLocationQuery(buildDisplayLocationName(result));
  const provinceLikeFeature = result.feature_code?.toUpperCase().startsWith("ADM1") ? 1 : 0;

  let score = 0;

  if (resultName === normalizedQuery) {
    score += 120;
  }

  if (displayName === normalizedQuery) {
    score += 90;
  }

  if (resultName.startsWith(normalizedQuery)) {
    score += 60;
  }

  if (displayName.startsWith(normalizedQuery)) {
    score += 40;
  }

  if (normalizedQuery.includes(resultName)) {
    score += 50;
  }

  if (normalizedQuery.includes(admin1) && admin1) {
    score += 25;
  }

  if (normalizedQuery.includes(admin2) && admin2) {
    score += 20;
  }

  score -= provinceLikeFeature * 15;
  score += Math.min(result.population ?? 0, 5_000_000) / 100_000;

  return score;
}

async function fetchPhilippineGeocodingResults(query: string) {
  const normalizedQuery = query.trim();

  if (normalizedQuery.length < 2) {
    return [];
  }

  const searchParams = new URLSearchParams({
    name: normalizedQuery,
    count: "10",
    language: "en",
    countryCode: PHILIPPINES_COUNTRY_CODE,
  });

  const { signal, clear } = createAbortSignal(REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${OPEN_METEO_GEOCODING_URL}?${searchParams.toString()}`, {
      headers: {
        Accept: "application/json",
      },
      signal,
    });

    if (!response.ok) {
      throw new Error(GENERIC_LOCATION_ERROR_MESSAGE);
    }

    const payload = (await response.json()) as GeocodingSearchResponse;
    return (payload.results ?? []).filter(
      (result) => result.country_code === PHILIPPINES_COUNTRY_CODE,
    );
  } finally {
    clear();
  }
}

async function reverseGeocodePhilippineLocationName(latitude: number, longitude: number) {
  const searchParams = new URLSearchParams({
    format: "jsonv2",
    lat: String(latitude),
    lon: String(longitude),
    zoom: "12",
    addressdetails: "1",
    "accept-language": "en",
    layer: "address",
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
      return null;
    }

    const payload = (await response.json()) as ReverseGeocodingResponse;
    const countryCode = payload.address?.country_code?.toUpperCase();

    if (countryCode && countryCode !== PHILIPPINES_COUNTRY_CODE) {
      return null;
    }

    return (
      payload.address?.city ||
      payload.address?.town ||
      payload.address?.municipality ||
      payload.address?.village ||
      payload.address?.suburb ||
      payload.address?.county ||
      payload.address?.state ||
      payload.display_name?.split(",")[0]?.trim() ||
      null
    );
  } catch {
    return null;
  } finally {
    clear();
  }
}

function getCurrentHourIndex(hourlyTimes: string[] | undefined, currentTime: string | undefined) {
  if (!hourlyTimes || !currentTime) {
    return -1;
  }

  return hourlyTimes.findIndex((time) => time === currentTime);
}

function pickPrecipitationValue(payload: OpenMeteoResponse) {
  const currentPrecipitation = payload.current?.precipitation;

  if (typeof currentPrecipitation === "number") {
    return currentPrecipitation;
  }

  const currentHourIndex = getCurrentHourIndex(payload.hourly?.time, payload.current?.time);

  if (currentHourIndex < 0) {
    return null;
  }

  const hourlyPrecipitation = payload.hourly?.precipitation?.[currentHourIndex];

  if (typeof hourlyPrecipitation === "number") {
    return hourlyPrecipitation;
  }

  const hourlyRain = payload.hourly?.rain?.[currentHourIndex];

  if (typeof hourlyRain === "number") {
    return hourlyRain;
  }

  const hourlyShowers = payload.hourly?.showers?.[currentHourIndex];

  if (typeof hourlyShowers === "number") {
    return hourlyShowers;
  }

  return null;
}

function getForecastPeakPrecipitation(payload: OpenMeteoResponse) {
  const precipitationValues = [
    ...(payload.hourly?.precipitation ?? []),
    ...(payload.hourly?.rain ?? []),
    ...(payload.hourly?.showers ?? []),
  ].filter((value): value is number => typeof value === "number" && !Number.isNaN(value));

  if (precipitationValues.length === 0) {
    return null;
  }

  return Math.max(...precipitationValues);
}

function roundIfNumber(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }

  return Math.round(value * 10) / 10;
}

function buildAlertTitle(riskLevel: FloodRiskLevel) {
  if (riskLevel === "Critical") {
    return "Critical Weather-Based Flood Risk";
  }

  if (riskLevel === "High") {
    return "High Weather-Based Flood Risk";
  }

  return "Elevated Weather-Based Flood Risk";
}

function buildAlertDescription(location: string, riskLevel: FloodRiskLevel) {
  if (riskLevel === "Critical") {
    return `Heavy rainfall signals may sharply raise flood risk in ${location}, especially in low-lying areas and near waterways.`;
  }

  if (riskLevel === "High") {
    return `Rainfall intensity may increase flood risk in ${location}. Monitor local conditions and watch for official advisories.`;
  }

  return `Weather signals suggest elevated flood risk in ${location}. Monitor local conditions and watch for official advisories.`;
}

async function fetchOpenMeteoWeather(location: WeatherLookupLocation) {
  const searchParams = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current: [
      "temperature_2m",
      "relative_humidity_2m",
      "precipitation",
      "weather_code",
      "wind_speed_10m",
    ].join(","),
    hourly: ["precipitation", "rain", "showers"].join(","),
    forecast_days: "1",
    timezone: WEATHER_TIME_ZONE,
  });

  const { signal, clear } = createAbortSignal(REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${OPEN_METEO_URL}?${searchParams.toString()}`, {
      headers: {
        Accept: "application/json",
      },
      signal,
    });

    if (!response.ok) {
      throw new Error(`Open-Meteo request failed with status ${response.status}.`);
    }

    return (await response.json()) as OpenMeteoResponse;
  } finally {
    clear();
  }
}

function buildWeatherLocation(
  location: WeatherLookupLocation,
  payload: OpenMeteoResponse,
  officialMetadata: OfficialSourceMetadata = {},
): WeatherLocation {
  const precipitation = roundIfNumber(pickPrecipitationValue(payload));
  const forecastPeakPrecipitation = roundIfNumber(getForecastPeakPrecipitation(payload));
  const condition = mapWeatherCodeToCondition(payload.current?.weather_code);
  const riskLevel = getRiskLevel(precipitation, forecastPeakPrecipitation, condition);

  return {
    name: location.name,
    latitude: location.latitude,
    longitude: location.longitude,
    temperature: roundIfNumber(payload.current?.temperature_2m),
    precipitation,
    humidity: roundIfNumber(payload.current?.relative_humidity_2m),
    windSpeed: roundIfNumber(payload.current?.wind_speed_10m),
    condition,
    riskLevel,
    updatedAt: formatWeatherTimestamp(payload.current?.time),
    source: getWeatherDataSource(),
    officialReference: getPagasaOfficialReference(officialMetadata),
    disclaimer: WEATHER_RISK_DISCLAIMER,
    officialSourceName: officialMetadata.officialSourceName,
    officialSourceUrl: officialMetadata.officialSourceUrl,
    officialIssuedAt: officialMetadata.officialIssuedAt,
    officialValidUntil: officialMetadata.officialValidUntil,
    officialArea: officialMetadata.officialArea,
    officialSummary: officialMetadata.officialSummary,
  };
}

async function fetchWeatherForLocation(location: WeatherLookupLocation): Promise<WeatherLocation> {
  const payload = await fetchOpenMeteoWeather(location);
  return buildWeatherLocation(location, payload);
}

async function geocodePhilippineLocation(query: string) {
  const searchAttempts = buildLocationSearchAttempts(query);

  if (searchAttempts.length === 0) {
    throw new Error(LOCATION_NOT_FOUND_MESSAGE);
  }

  for (const attempt of searchAttempts) {
    const philippineResults = await fetchPhilippineGeocodingResults(attempt);

    if (philippineResults.length === 0) {
      continue;
    }

    philippineResults.sort(
      (left, right) => scorePhilippineResult(right, attempt) - scorePhilippineResult(left, attempt),
    );

    return philippineResults[0];
  }

  throw new Error(LOCATION_NOT_FOUND_MESSAGE);
}

function sortLocationsByRisk(locations: WeatherLocation[]) {
  return locations
    .map((location, index) => ({ location, index }))
    .sort((left, right) => {
      const priorityDifference =
        getRiskPriority(left.location.riskLevel) - getRiskPriority(right.location.riskLevel);

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      return left.index - right.index;
    })
    .map((entry) => entry.location);
}

function buildSystemAlerts(locations: WeatherLocation[]): FloodAlert[] {
  return locations
    .filter((location) => location.riskLevel !== "Low")
    .map((location) => ({
      id: `${location.name.toLowerCase().replace(/\s+/g, "-")}-${location.riskLevel.toLowerCase()}`,
      title: buildAlertTitle(location.riskLevel),
      severity: getSeverityFromRiskLevel(location.riskLevel),
      location: location.name,
      riskLevel: location.riskLevel,
      precipitation: location.precipitation,
      description: buildAlertDescription(location.name, location.riskLevel),
      updatedAt: location.updatedAt,
      source: {
        category: "system",
        label: SOURCE_LABELS.system,
        name: "FloodWatch PH",
        note: "Weather-based system alert derived from Open-Meteo conditions.",
      },
      officialReference: location.officialReference,
      disclaimer: WEATHER_RISK_DISCLAIMER,
    }));
}

function createOverviewResponse(locations: WeatherLocation[]): WeatherOverviewData {
  return {
    locations,
    alerts: buildSystemAlerts(locations),
    fetchedAt: formatWeatherTimestamp(new Date().toISOString()),
    advisoryMessage: WEATHER_RISK_DISCLAIMER,
  };
}

export function getWeatherCacheHeaders() {
  return {
    "Cache-Control": `public, s-maxage=${WEATHER_SOURCE_CACHE_SECONDS}, stale-while-revalidate=${WEATHER_SOURCE_CACHE_SECONDS / 2}`,
  };
}

export function getWeatherUnavailableMessage() {
  return WEATHER_UNAVAILABLE_MESSAGE;
}

export async function getWeatherOverview(): Promise<WeatherOverviewData> {
  const results = await Promise.allSettled(
    MONITORED_LOCATIONS.map((location) => fetchWeatherForLocation(location)),
  );
  const locations = sortLocationsByRisk(
    results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : [])),
  );

  if (locations.length === 0) {
    throw new Error(WEATHER_UNAVAILABLE_MESSAGE);
  }

  return createOverviewResponse(locations);
}

export function getSidebarWeatherOverview(overview: WeatherOverviewData): WeatherOverviewData {
  const allLowRisk = overview.locations.every((location) => location.riskLevel === "Low");
  const sidebarLocations = allLowRisk
    ? overview.locations.slice(0, SIDEBAR_LOCATION_LIMIT)
    : sortLocationsByRisk(overview.locations).slice(0, SIDEBAR_LOCATION_LIMIT);

  return {
    ...overview,
    locations: sidebarLocations,
  };
}

export async function getWeatherByQuery(query: string): Promise<WeatherLocationResult> {
  const geocodedLocation = await geocodePhilippineLocation(query);
  const location = await fetchWeatherForLocation({
    name: buildDisplayLocationName(geocodedLocation),
    latitude: geocodedLocation.latitude,
    longitude: geocodedLocation.longitude,
  });

  return {
    location,
    fetchedAt: formatWeatherTimestamp(new Date().toISOString()),
    advisoryMessage: WEATHER_RISK_DISCLAIMER,
  };
}

export async function getWeatherByCoordinates(
  latitude: number,
  longitude: number,
  name?: string,
): Promise<WeatherLocationResult> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error(GENERIC_LOCATION_ERROR_MESSAGE);
  }

  if (!isWithinPhilippines(latitude, longitude)) {
    throw new Error(LOCATION_NOT_FOUND_MESSAGE);
  }

  const fallbackName = name?.trim();
  const resolvedLocationName =
    !fallbackName || fallbackName === "Your Location"
      ? (await reverseGeocodePhilippineLocationName(latitude, longitude)) ?? "Your Location"
      : fallbackName;

  const location = await fetchWeatherForLocation({
    name: resolvedLocationName,
    latitude,
    longitude,
  });

  return {
    location,
    fetchedAt: formatWeatherTimestamp(new Date().toISOString()),
    advisoryMessage: WEATHER_RISK_DISCLAIMER,
  };
}

export async function getWeatherSources(): Promise<WeatherSourcesData> {
  return getWeatherSourcesData();
}
