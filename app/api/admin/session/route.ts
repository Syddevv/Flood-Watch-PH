import { adminSuccessResponse } from "@/lib/admin-api-response";
import { requireAdminApi, toAdminDto } from "@/lib/admin-auth";

export async function GET(request: Request) {
  const result = await requireAdminApi(request);
  if (result.response) return result.response;
  return adminSuccessResponse(request, { user: toAdminDto(result.user) });
}
