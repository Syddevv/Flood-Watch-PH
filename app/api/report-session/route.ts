import { errorResponse, successResponse } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { protectApiRequest } from "@/lib/request-security";
import {
  createReportSession,
  getReportSessionHashFromRequest,
} from "@/lib/report-session";

type SessionBootstrapPayload = {
  legacySessionHash?: unknown;
};

function getLegacySessionHash(value: unknown) {
  return typeof value === "string" && /^[a-f0-9]{32}$/i.test(value)
    ? value.toLowerCase()
    : "";
}

export async function POST(request: Request) {
  try {
    const protectionResponse = await protectApiRequest(request, {
      scope: "report-session",
      limit: 10,
      windowMs: 60 * 60 * 1000,
      requireTrustedOrigin: true,
    });

    if (protectionResponse) {
      return protectionResponse;
    }

    if (getReportSessionHashFromRequest(request)) {
      return successResponse({ initialized: true, migrated: false });
    }

    const payload = (await request.json().catch(() => ({}))) as SessionBootstrapPayload;
    const legacySessionHash = getLegacySessionHash(payload.legacySessionHash);
    const session = createReportSession();
    let migrated = false;

    if (legacySessionHash) {
      migrated = await prisma.$transaction(async (tx) => {
        const report = await tx.floodReport.findFirst({
          where: { ownerSessionHash: legacySessionHash },
          select: { id: true },
        });
        const confirmation = report
          ? null
          : await tx.reportConfirmation.findFirst({
              where: { ipHash: legacySessionHash },
              select: { id: true },
            });

        if (!report && !confirmation) {
          return false;
        }

        await tx.floodReport.updateMany({
          where: { ownerSessionHash: legacySessionHash },
          data: { ownerSessionHash: session.sessionHash },
        });
        await tx.reportConfirmation.updateMany({
          where: { ipHash: legacySessionHash },
          data: { ipHash: session.sessionHash },
        });

        return true;
      });
    }

    return successResponse(
      { initialized: true, migrated },
      {
        headers: {
          "Set-Cookie": session.cookie,
        },
      },
    );
  } catch (error) {
    console.error("Failed to initialize report session.", error);
    return errorResponse("Unable to initialize the report session.", 503);
  }
}
