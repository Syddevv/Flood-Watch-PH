import { requireProtectedAdminApi } from "@/lib/admin-auth";
import { exportAdminRescueQueue } from "@/lib/admin-rescue-queue";
import { rescueApiError } from "@/lib/rescue-api";

export async function GET(request: Request) {
  try {
    const auth = await requireProtectedAdminApi(request, { scope: "admin-rescue-export", limit: 10, windowMs: 60_000 });
    if (auth.response) return auth.response;
    const csv = await exportAdminRescueQueue(new URL(request.url).searchParams);
    return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="rescue-queue.csv"', "Cache-Control": "private, no-store" } });
  } catch (error) { return rescueApiError(request, error); }
}
