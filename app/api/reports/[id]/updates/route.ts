import { errorResponse, successResponse } from "@/lib/api-response";
import { prisma, type PrismaTransactionClient } from "@/lib/prisma";
import {
  REPORT_OWNER_FORBIDDEN_MESSAGE,
  isReportOwner,
  parseReportUpdateFormData,
  reportDetailInclude,
  serializeReportRecord,
  uploadReportImageFile,
  type PublicReportRecord,
} from "@/lib/report-api";
import { getReportSessionHashFromRequest } from "@/lib/report-session";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const sessionHash = getReportSessionHashFromRequest(request);

    const existingReport = await prisma.floodReport.findUnique({
      where: { id },
      include: reportDetailInclude,
    });

    if (!existingReport) {
      return errorResponse("Flood report not found.", 404);
    }

    if (!isReportOwner(existingReport as PublicReportRecord, sessionHash)) {
      return errorResponse(REPORT_OWNER_FORBIDDEN_MESSAGE, 403);
    }

    const formData = await request.formData();
    const imageFile = formData.get("image");

    if (imageFile && typeof imageFile === "string") {
      return errorResponse("Invalid image upload.", 400);
    }

    const parsedUpdate = parseReportUpdateFormData(formData);

    if (parsedUpdate.error || !parsedUpdate.data) {
      return errorResponse(parsedUpdate.error ?? "Invalid report update.", 400);
    }

    let imageUrl: string | undefined;

    if (imageFile instanceof File && imageFile.size > 0) {
      const uploadResult = await uploadReportImageFile(imageFile);

      if (uploadResult.error) {
        return errorResponse(uploadResult.error, 400);
      }

      imageUrl = uploadResult.imageUrl;
    }

    const now = new Date();

    const updatedReport = await prisma.$transaction(async (tx: PrismaTransactionClient) => {
      await tx.reportUpdate.create({
        data: {
          reportId: id,
          updateType: "Uploader Update",
          message: parsedUpdate.data.message,
          imageUrl,
          severity: parsedUpdate.data.severity,
        },
      });

      return tx.floodReport.update({
        where: { id },
        data: {
          ...(parsedUpdate.data.severity ? { severity: parsedUpdate.data.severity } : {}),
          lastActivityAt: now,
        },
        include: reportDetailInclude,
      });
    });

    return successResponse(serializeReportRecord(updatedReport as PublicReportRecord, sessionHash));
  } catch (error) {
    console.error("Failed to create report update.", error);
    return errorResponse("Something went wrong while updating the report.");
  }
}
