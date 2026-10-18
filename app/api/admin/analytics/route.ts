import { adminErrorResponse, adminSuccessResponse } from "@/lib/admin-api-response";
import { loadAdminAnalytics } from "@/lib/admin-analytics";
import { AnalyticsFilterError, parseAnalyticsFilters } from "@/lib/admin-analytics-policy";
import { requireProtectedAdminApi } from "@/lib/admin-auth";

export async function GET(request: Request) {
  const auth = await requireProtectedAdminApi(request, { scope: "admin-analytics", limit: 30, windowMs: 60_000 });
  if (auth.response) return auth.response;
  try {
    const data = await loadAdminAnalytics(parseAnalyticsFilters(new URL(request.url).searchParams));
    if (data.sources.reports === "unavailable" && data.sources.incidents === "unavailable" && data.sources.rescues === "unavailable") return adminErrorResponse(request, "Analytics sources are temporarily unavailable.", 503);
    return adminSuccessResponse(request, data);
  } catch (error) {
    if (error instanceof AnalyticsFilterError) return adminErrorResponse(request, error.message, 400);
    console.error("Admin analytics failed", error);
    return adminErrorResponse(request, "Analytics are temporarily unavailable.", 503);
  }
}
