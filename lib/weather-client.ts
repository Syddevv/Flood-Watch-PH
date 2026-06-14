import type { WeatherLocationResult, WeatherOverviewData } from "@/lib/types";

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

export async function fetchWeatherOverview(signal?: AbortSignal) {
  const response = await fetch("/api/weather/overview", {
    cache: "no-store",
    signal,
  });
  const payload = (await response.json()) as WeatherOverviewResponse;

  if (!response.ok || !("data" in payload)) {
    throw new Error("error" in payload ? payload.error : "Unable to load weather data.");
  }

  return payload.data;
}

export async function fetchWeatherLocation(
  params: { query: string } | { lat: number; lon: number; name?: string },
  signal?: AbortSignal,
) {
  const searchParams = new URLSearchParams();

  if ("query" in params) {
    searchParams.set("query", params.query);
  } else {
    searchParams.set("lat", params.lat.toString());
    searchParams.set("lon", params.lon.toString());

    if (params.name?.trim()) {
      searchParams.set("name", params.name.trim());
    }
  }

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
