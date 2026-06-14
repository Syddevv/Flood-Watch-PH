import type { AlertSeverity, FloodAlert, FloodRiskLevel, WeatherLocation, WeatherOverviewData } from "@/lib/types";

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const WEATHER_SOURCE_LABEL = "Weather data from Open-Meteo";
const ALERT_SOURCE_LABEL = "Weather-based system alert";
const WEATHER_TIME_ZONE = "Asia/Manila";
const REQUEST_TIMEOUT_MS = 8000;

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

    const payload = (await response.json()) as OpenMeteoResponse;
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
  } finally {
    clear();
  }
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
  const locations = results
    .flatMap((result) => (result.status === "fulfilled" ? [result.value] : []))
    .sort((left, right) => left.name.localeCompare(right.name));

  if (locations.length === 0) {
    throw new Error("Unable to load weather data.");
  }

  return {
    locations,
    alerts: buildSystemAlerts(locations),
    fetchedAt: formatWeatherTimestamp(new Date().toISOString()),
  };
}
