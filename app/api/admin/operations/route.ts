import { adminErrorResponse, adminSuccessResponse } from "@/lib/admin-api-response";
import { requireProtectedAdminApi } from "@/lib/admin-auth";
import { getAdminOperationsSnapshot } from "@/lib/admin-operations-data";
import { logApiError } from "@/lib/structured-logger";

export async function GET(request: Request) {
  const auth = await requireProtectedAdminApi(request, { scope: "admin-operations-read", limit: 120, windowMs: 60_000 });
  if (auth.response) return auth.response;
  try {
    return adminSuccessResponse(request, await getAdminOperationsSnapshot());
  } catch (error) {
    logApiError("admin-operations-fetch-failed", request, error);
    return adminErrorResponse(request, "Unable to load operational records.");
  }
}
