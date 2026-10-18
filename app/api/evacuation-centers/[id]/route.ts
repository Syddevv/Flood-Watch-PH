import { errorResponse, successResponse } from "@/lib/api-response";
import { isPublishableCenter, toPublicCenter } from "@/lib/public-evacuation-centers";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const center = await prisma.evacuationCenter.findUnique({ where: { id } });
  if (!center || !isPublishableCenter(center)) return errorResponse("Evacuation center not found.", 404);
  return successResponse({ center: toPublicCenter(center) }, { headers: { "Cache-Control": "no-store" } });
}
