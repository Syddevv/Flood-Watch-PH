import { getAuthenticatedUserFromRequest } from "@/lib/auth-session";
import type { ReportIdentity } from "@/lib/report-api";
import { getReportSessionHashFromRequest } from "@/lib/report-session";

export async function getReportIdentityFromRequest(request: Request): Promise<ReportIdentity> {
  const sessionHash = getReportSessionHashFromRequest(request);
  const authenticatedUser = await getAuthenticatedUserFromRequest(request);

  return {
    sessionHash: sessionHash || undefined,
    userId: authenticatedUser?.id,
    role: authenticatedUser?.role,
  };
}
