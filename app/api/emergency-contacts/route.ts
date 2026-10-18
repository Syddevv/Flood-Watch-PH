import { errorResponse, successResponse } from "@/lib/api-response";
import { dedupePublicContacts, isPublishableContact, toPublicContact } from "@/lib/emergency-contact-policy";
import { prisma } from "@/lib/prisma";
import { protectApiRequest } from "@/lib/request-security";
import { logApiError } from "@/lib/structured-logger";

export async function GET(request: Request) {
  try {
    const protection = await protectApiRequest(request, { scope: "emergency-contacts", limit: 120, windowMs: 60_000 });
    if (protection) return protection;
    const rows = await prisma.emergencyContact.findMany({
      where: { verificationStatus: { in: ["verified", "official_publication_found"] }, isArchived: false, OR: [{ province: { equals: "Bulacan", mode: "insensitive" } }, { isNational: true }] },
      orderBy: [{ preferred: "desc" }, { isNational: "asc" }, { agencyName: "asc" }, { contactNumber: "asc" }],
      take: 200,
    });
    const directoryView = new URL(request.url).searchParams.get("view") === "directory";
    const hasDirectoryPdrrmo = rows.some((row) => row.sourceKey === "contact-bulacan-bulacan-pdrrmo-bulacan-rescue");
    const publishable = rows.filter((row) => isPublishableContact(row) &&
      (directoryView || !(hasDirectoryPdrrmo && row.sourceKey?.startsWith("bulacan-pdrrmo-"))));
    const contacts = (directoryView ? publishable : dedupePublicContacts(publishable)).map((row) => toPublicContact(row));
    return successResponse({ contacts }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logApiError("emergency-contacts-fetch-failed", request, error);
    return errorResponse("Emergency contacts are temporarily unavailable.", 503);
  }
}
