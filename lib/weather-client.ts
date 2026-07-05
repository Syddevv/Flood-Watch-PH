import type {
  WeatherLocationResult,
  WeatherOverviewData,
  WeatherSourcesData,
} from "@/lib/types";

type WeatherOverviewResponse =
  | {
      data: WeatherOverviewData;
    }
  | {
      error: string;
    };

type WeatherLocationResponse =
  | {
      data: WeatherLocationResult;
    }
  | {
      error: string;
    };

type WeatherSourcesResponse =
  | {
      data: WeatherSourcesData;
    }
  | {
      error: string;
    };

export type WeatherOverviewFetchResult = {
  data: WeatherOverviewData;
  error: string | null;
};

const WEATHER_UNAVAILABLE_MESSAGE =
  "Weather data is temporarily unavailable. Please check PAGASA or try again later.";

const EMPTY_WEATHER_OVERVIEW: WeatherOverviewData = {
  locations: [],
  alerts: [],
  fetchedAt: "",
  advisoryMessage: WEATHER_UNAVAILABLE_MESSAGE,
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function readJsonResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().includes("application/json")) {
    return null;
  }

  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

function getErrorMessage(payload: unknown, fallback = WEATHER_UNAVAILABLE_MESSAGE) {
  if (!isObject(payload) || typeof payload.error !== "string" || payload.error.trim() === "") {
    return fallback;
  }

  return payload.error;
}

function normalizeWeatherOverviewData(value: unknown): WeatherOverviewData | null {
  if (!isObject(value)) {
    return null;
  }

  return {
    locations: Array.isArray(value.locations) ? value.locations : [],
    alerts: Array.isArray(value.alerts) ? value.alerts : [],
    fetchedAt: typeof value.fetchedAt === "string" ? value.fetchedAt : "",
    advisoryMessage:
      typeof value.advisoryMessage === "string" && value.advisoryMessage.trim() !== ""
        ? value.advisoryMessage
        : WEATHER_UNAVAILABLE_MESSAGE,
  } as WeatherOverviewData;
}

function weatherOverviewFallback(error = WEATHER_UNAVAILABLE_MESSAGE): WeatherOverviewFetchResult {
  return {
    data: {
      ...EMPTY_WEATHER_OVERVIEW,
      advisoryMessage: error,
    },
    error,
  };
}

export async function fetchWeatherOverview(signal?: AbortSignal) {
  try {
    const response = await fetch("/api/weather/overview", {
      cache: "no-store",
      signal,
    });
    const payload = (await readJsonResponse(response)) as WeatherOverviewResponse | null;

    if (!response.ok) {
      return weatherOverviewFallback(getErrorMessage(payload));
    }

    if (!isObject(payload) || !("data" in payload)) {
      return weatherOverviewFallback();
    }

    const data = normalizeWeatherOverviewData(payload.data);

    if (!data) {
      return weatherOverviewFallback();
    }

    if (data.locations.length === 0) {
      return weatherOverviewFallback(data.advisoryMessage || WEATHER_UNAVAILABLE_MESSAGE);
    }

    return {
      data,
      error: null,
    };
  } catch {
    return weatherOverviewFallback();
  }
}

export async function fetchWeatherLocation(
  params: { query: string } | { lat: number; lon: number; name?: string },
  signal?: AbortSignal,
) {
  if ("query" in params) {
    const searchParams = new URLSearchParams({
      query: params.query,
    });

    const response = await fetch(`/api/weather/location?${searchParams.toString()}`, {
      cache: "no-store",
      signal,
    });
    const payload = (await response.json()) as WeatherLocationResponse;

    if (!response.ok || !("data" in payload)) {
      throw new Error(
        "error" in payload ? payload.error : "Unable to load weather for this location. Please try again.",
      );
    }

    return payload.data;
  }

  const searchParams = new URLSearchParams({
    lat: params.lat.toString(),
    lng: params.lon.toString(),
  });

  if (params.name?.trim()) {
    searchParams.set("name", params.name.trim());
  }

  const response = await fetch(`/api/weather/coordinates?${searchParams.toString()}`, {
    cache: "no-store",
    signal,
  });
  const payload = (await response.json()) as WeatherLocationResponse;

  if (!response.ok || !("data" in payload)) {
    throw new Error(
      "error" in payload ? payload.error : "Unable to load weather for this location. Please try again.",
    );
  }

  return payload.data;
}

export async function fetchWeatherSources(signal?: AbortSignal) {
  const response = await fetch("/api/weather/sources", {
    cache: "no-store",
    signal,
  });
  const payload = (await response.json()) as WeatherSourcesResponse;

  if (!response.ok || !("data" in payload)) {
    throw new Error(
      "error" in payload ? payload.error : "Unable to load official weather references.",
    );
  }

  return payload.data;
}
