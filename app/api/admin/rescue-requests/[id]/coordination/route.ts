import { adminSuccessResponse } from "@/lib/admin-api-response";
import { requireProtectedAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { recordRescueCoordination } from "@/lib/rescue-dispatch-data";
import { readRescueJson, rescueApiError } from "@/lib/rescue-api";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireProtectedAdminApi(request, { scope: "admin-rescue-coordination", limit: 60, windowMs: 60_000 });
    if (auth.response) return auth.response;
    return adminSuccessResponse(request, await recordRescueCoordination(prisma, auth.user.id, (await params).id, await readRescueJson(request)));
  } catch (error) { return rescueApiError(request, error); }
}
