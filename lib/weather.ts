import type {
  AlertSeverity,
  FloodAlert,
  FloodRiskLevel,
  WeatherLocation,
  WeatherLocationResult,
  WeatherOverviewData,
} from "@/lib/types";

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const OPEN_METEO_GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";
const WEATHER_SOURCE_LABEL = "Weather data from Open-Meteo";
const ALERT_SOURCE_LABEL = "Weather-based system alert";
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

type MonitoredLocation = (typeof MONITORED_LOCATIONS)[number];

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
  country?: string;
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

function getRiskLevel(precipitation: number | null): FloodRiskLevel {
  if (precipitation === null || precipitation < 2) {
    return "Low Risk";
  }

  if (precipitation < 7.5) {
    return "Moderate Risk";
  }

  if (precipitation < 15) {
    return "High Risk";
  }

  return "Critical Risk";
}

function getSeverityFromRiskLevel(riskLevel: FloodRiskLevel): AlertSeverity {
  if (riskLevel === "Critical Risk") {
    return "severe";
  }

  if (riskLevel === "High Risk") {
    return "high";
  }

  if (riskLevel === "Moderate Risk") {
    return "moderate";
  }

  return "safe";
}

function getRiskPriority(riskLevel: FloodRiskLevel) {
  if (riskLevel === "Critical Risk") {
    return 0;
  }

  if (riskLevel === "High Risk") {
    return 1;
  }

  if (riskLevel === "Moderate Risk") {
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
      typeof part === "string" && part.trim().length > 0 && items.indexOf(part) === index && part !== result.name,
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
      cache: "no-store",
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
      cache: "no-store",
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

function roundIfNumber(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }

  return Math.round(value * 10) / 10;
}

function buildAlertTitle(riskLevel: FloodRiskLevel) {
  if (riskLevel === "Critical Risk") {
    return "Critical Rainfall Risk Detected";
  }

  if (riskLevel === "High Risk") {
    return "Heavy Rainfall Risk Detected";
  }

  return "Elevated Rainfall Risk Detected";
}

function buildAlertDescription(location: string, riskLevel: FloodRiskLevel) {
  if (riskLevel === "Critical Risk") {
    return `Increased flood risk due to intense rainfall in ${location}, especially in low-lying and flood-prone areas.`;
  }

  if (riskLevel === "High Risk") {
    return `Recent rainfall levels may increase flood risk in ${location}, especially near low-lying roads and waterways.`;
  }

  return `Rainfall-based flood risk is elevated in ${location}. Monitor local conditions and watch for official advisories.`;
}

async function fetchLocationWeather(location: MonitoredLocation): Promise<WeatherLocation> {
  return fetchWeatherForLocation(location);
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
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Open-Meteo request failed with status ${response.status}.`);
    }

    return (await response.json()) as OpenMeteoResponse;
  } finally {
    clear();
  }
}

async function fetchWeatherForLocation(location: WeatherLookupLocation): Promise<WeatherLocation> {
  const payload = await fetchOpenMeteoWeather(location);
  const precipitation = roundIfNumber(pickPrecipitationValue(payload));
  const riskLevel = getRiskLevel(precipitation);

  return {
    name: location.name,
    latitude: location.latitude,
    longitude: location.longitude,
    temperature: roundIfNumber(payload.current?.temperature_2m),
    precipitation,
    humidity: roundIfNumber(payload.current?.relative_humidity_2m),
    windSpeed: roundIfNumber(payload.current?.wind_speed_10m),
    condition: mapWeatherCodeToCondition(payload.current?.weather_code),
    riskLevel,
    updatedAt: formatWeatherTimestamp(payload.current?.time),
    source: WEATHER_SOURCE_LABEL,
  };
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
    .filter((location) => location.riskLevel !== "Low Risk")
    .map((location) => ({
      id: `${location.name.toLowerCase().replace(/\s+/g, "-")}-${location.riskLevel.toLowerCase().replace(/\s+/g, "-")}`,
      title: buildAlertTitle(location.riskLevel),
      severity: getSeverityFromRiskLevel(location.riskLevel),
      location: location.name,
      riskLevel: location.riskLevel,
      precipitation: location.precipitation,
      description: buildAlertDescription(location.name, location.riskLevel),
      updatedAt: location.updatedAt,
      source: ALERT_SOURCE_LABEL,
    }));
}

export async function getWeatherOverview(): Promise<WeatherOverviewData> {
  const results = await Promise.allSettled(MONITORED_LOCATIONS.map((location) => fetchLocationWeather(location)));
  const locations = sortLocationsByRisk(
    results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : [])),
  );

  if (locations.length === 0) {
    throw new Error("Unable to load weather data.");
  }

  return {
    locations,
    alerts: buildSystemAlerts(locations),
    fetchedAt: formatWeatherTimestamp(new Date().toISOString()),
  };
}

export function getSidebarWeatherOverview(overview: WeatherOverviewData): WeatherOverviewData {
  const allLowRisk = overview.locations.every((location) => location.riskLevel === "Low Risk");
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
  };
}

export async function getWeatherByCoordinates(
  latitude: number,
  longitude: number,
  name?: string,
): Promise<WeatherLocationResult> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("Unable to load weather for this location. Please try again.");
  }

  if (!isWithinPhilippines(latitude, longitude)) {
    throw new Error("Location not found. Try another city, municipality, or province.");
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
  };
}
