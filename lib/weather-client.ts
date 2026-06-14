import type { WeatherOverviewData } from "@/lib/types";

type WeatherOverviewResponse =
  | {
      data: WeatherOverviewData;
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
