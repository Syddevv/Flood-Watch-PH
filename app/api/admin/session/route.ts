import { successResponse } from "@/lib/api-response";
import { requireAdminApi, toAdminDto } from "@/lib/admin-auth";

export async function GET(request: Request) {
  const result = await requireAdminApi(request);
  if (result.response) return result.response;
  return successResponse({ user: toAdminDto(result.user) }, { headers: { "Cache-Control": "no-store" } });
}
