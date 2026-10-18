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
    const hasDirectoryPdrrmo = rows.some((row) => row.sourceKey === "contact-bulacan-bulacan-pdrrmo-bulacan-rescue");
    const contacts = dedupePublicContacts(rows.filter((row) =>
      isPublishableContact(row) && !(hasDirectoryPdrrmo && row.sourceKey?.startsWith("bulacan-pdrrmo-"))
    )).map((row) => toPublicContact(row));
    return successResponse({ contacts }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logApiError("emergency-contacts-fetch-failed", request, error);
    return errorResponse("Emergency contacts are temporarily unavailable.", 503);
  }
}
