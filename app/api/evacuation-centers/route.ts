import { successResponse } from "@/lib/api-response";
import { getPublicEvacuationCenters } from "@/lib/public-evacuation-query";

export async function GET() {
  return successResponse({ centers: await getPublicEvacuationCenters() }, {
    headers: { "Cache-Control": "no-store" },
  });
}
