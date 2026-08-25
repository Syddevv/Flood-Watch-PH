import { errorResponse, successResponse } from "@/lib/api-response";
import {
  getLifecyclePersistencePatch,
  type ReportLifecycleStatus,
} from "@/lib/report-lifecycle";
import { prisma } from "@/lib/prisma";
import {
  REPORT_OWNER_FORBIDDEN_MESSAGE,
  canAccessArchivedReport,
  isReportOwner,
  parseReportDetailsFormData,
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

export async function GET(request: Request, context: RouteContext) {
  try {
    const protectionResponse = await protectApiRequest(request, {
      scope: "report-detail",
      limit: 120,
      windowMs: 60 * 1000,
    });

    if (protectionResponse) {
      return protectionResponse;
    }

    const { id } = await context.params;
    const includeArchived = new URL(request.url).searchParams.get("includeArchived") === "true";
    const identity = await getReportIdentityFromRequest(request);

    const report = await prisma.floodReport.findUnique({
      where: { id },
      include: reportDetailInclude,
    });

    if (!report) {
      return errorResponse("Flood report not found.", 404);
    }

    const patch = getLifecyclePersistencePatch(report);
    const reconciledReport =
      Object.keys(patch).length > 0
        ? await prisma.floodReport.update({
            where: { id },
            data: patch,
            include: reportDetailInclude,
          })
        : report;

    if (
      (reconciledReport.status as ReportLifecycleStatus) === "Archived" &&
      !canAccessArchivedReport(reconciledReport, identity, includeArchived)
    ) {
      return errorResponse("Flood report not found.", 404);
    }

    return successResponse(serializeReportRecord(reconciledReport as PublicReportRecord, identity));
  } catch (error) {
    console.error("Failed to fetch report.", error);
    return errorResponse("Something went wrong while fetching the report.");
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const protectionResponse = await protectApiRequest(request, {
      scope: "report-edit",
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

    const parsedReport = parseReportDetailsFormData(formData);

    if (parsedReport.error || !parsedReport.data) {
      return errorResponse(parsedReport.error ?? "Invalid report details.", 400);
    }

    let imageUrl: string | undefined;

    if (imageFile instanceof File && imageFile.size > 0) {
      const uploadResult = await uploadReportImageFile(imageFile);

      if (uploadResult.error) {
        return errorResponse(uploadResult.error, uploadResult.status ?? 400);
      }

      imageUrl = uploadResult.imageUrl;
    }

    const updatedReport = await prisma.floodReport.update({
      where: { id },
      data: {
        ...parsedReport.data,
        ...(imageUrl ? { imageUrl } : {}),
        lastActivityAt: new Date(),
      },
      include: reportDetailInclude,
    });

    return successResponse(serializeReportRecord(updatedReport as PublicReportRecord, identity));
  } catch (error) {
    console.error("Failed to update report.", error);
    return errorResponse("Something went wrong while updating the report.");
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const protectionResponse = await protectApiRequest(request, {
      scope: "report-delete",
      limit: 10,
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
      select: {
        id: true,
        ownerSessionHash: true,
        userId: true,
      },
    });

    if (!existingReport) {
      return errorResponse("Flood report not found.", 404);
    }

    if (!isReportOwner(existingReport, identity)) {
      return errorResponse(REPORT_OWNER_FORBIDDEN_MESSAGE, 403);
    }

    await prisma.floodReport.delete({
      where: { id },
    });

    return successResponse({ id });
  } catch (error) {
    console.error("Failed to delete report.", error);
    return errorResponse("Something went wrong while deleting the report.");
  }
}
