import { errorResponse } from "@/lib/api-response";
import { getWeatherUnavailableMessage } from "@/lib/weather";

export function weatherProviderErrorResponse() {
  return errorResponse(getWeatherUnavailableMessage(), 503, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
