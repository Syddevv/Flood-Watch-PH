import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api-response";
import { isDatabaseHealthRequestAuthorized } from "@/lib/db-health-auth";
import { protectApiRequest } from "@/lib/request-security";
import { logApiError, withRequestId } from "@/lib/structured-logger";

export async function GET(request: Request) {
  if (!isDatabaseHealthRequestAuthorized(request)) {
    return withRequestId(errorResponse("Not found.", 404, {
      headers: { "Cache-Control": "no-store" },
    }), request);
  }

  const protectionResponse = await protectApiRequest(request, {
    scope: "db-health",
    limit: 30,
    windowMs: 60 * 1000,
    databaseFailureFallback: "memory",
  });

  if (protectionResponse) {
    return withRequestId(protectionResponse, request);
  }

  try {
    await prisma.$queryRaw`SELECT 1`;

    return withRequestId(Response.json({
      status: "ok",
      message: "Database connection is healthy",
    }, {
      headers: { "Cache-Control": "no-store" },
    }), request);
  } catch (error) {
    logApiError("db-health-check-failed", request, error);
    return withRequestId(Response.json(
      {
        status: "error",
        message: "Database connection failed",
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    ), request);
  }
}
