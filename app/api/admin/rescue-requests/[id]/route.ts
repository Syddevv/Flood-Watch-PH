import { adminSuccessResponse } from "@/lib/admin-api-response";
import { requireProtectedAdminApi } from "@/lib/admin-auth";
import { rescueApiError } from "@/lib/rescue-api";
import { getRescueRequest } from "@/lib/rescue-service";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireProtectedAdminApi(request, { scope: "admin-rescue-detail", limit: 120, windowMs: 60_000 });
    if (auth.response) return auth.response;
    return adminSuccessResponse(request, await getRescueRequest((await params).id, auth.user.id, true));
  } catch (error) { return rescueApiError(request, error); }
}
