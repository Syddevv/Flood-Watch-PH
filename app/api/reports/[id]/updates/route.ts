import { errorResponse, successResponse } from "@/lib/api-response";
import { prisma, type PrismaTransactionClient } from "@/lib/prisma";
import {
  REPORT_OWNER_FORBIDDEN_MESSAGE,
  isReportOwner,
  parseReportUpdateFormData,
  parseReportRequestFormData,
  reportDetailInclude,
  serializeReportRecord,
  uploadReportImageFile,
  type PublicReportRecord,
} from "@/lib/report-api";
import { getReportIdentityFromRequest } from "@/lib/report-identity";
import { protectApiRequest } from "@/lib/request-security";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const protectionResponse = await protectApiRequest(request, {
      scope: "report-update",
      limit: 20,
      windowMs: 60 * 60 * 1000,
      requireTrustedOrigin: true,
    });

    if (protectionResponse) {
      return protectionResponse;
    }

    const { id } = await context.params;
    const identity = await getReportIdentityFromRequest(request);

    const existingReport = await prisma.floodReport.findUnique({
      where: { id },
      include: reportDetailInclude,
    });

    if (!existingReport) {
      return errorResponse("Flood report not found.", 404);
    }

    if (!isReportOwner(existingReport as PublicReportRecord, identity)) {
      return errorResponse(REPORT_OWNER_FORBIDDEN_MESSAGE, 403);
    }

    const parsedFormData = await parseReportRequestFormData(request);

    if (parsedFormData.error || !parsedFormData.formData) {
      return errorResponse(
        parsedFormData.error ?? "Invalid multipart form data.",
        parsedFormData.status ?? 400,
      );
    }

    const formData = parsedFormData.formData;
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
        return errorResponse(uploadResult.error, uploadResult.status ?? 400);
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

    return successResponse(serializeReportRecord(updatedReport as PublicReportRecord, identity));
  } catch (error) {
    console.error("Failed to create report update.", error);
    return errorResponse("Something went wrong while updating the report.");
  }
}
