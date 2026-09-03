import { isValidReportSeverity, isValidReportStatus } from "@/lib/validations";

export const ADMIN_VERIFICATION_STATUSES = ["unreviewed", "verified", "disputed", "rejected"] as const;
export type AdminVerificationStatus = (typeof ADMIN_VERIFICATION_STATUSES)[number];
export const ADMIN_REPORT_SORTS = ["createdAt", "lastActivityAt", "severity", "locationName"] as const;

export function isAdminVerificationStatus(value: string): value is AdminVerificationStatus {
  return (ADMIN_VERIFICATION_STATUSES as readonly string[]).includes(value);
}

export function parseAdminReportFilters(params: URLSearchParams) {
  const search = params.get("search")?.trim().replace(/\s+/g, " ") ?? "";
  const verificationStatus = params.get("verificationStatus") ?? "";
  const publicStatus = params.get("publicStatus") ?? "";
  const severity = params.get("severity") ?? "";
  const incidentId = params.get("incidentId")?.trim() ?? "";
  const createdFrom = params.get("createdFrom") ?? "";
  const createdTo = params.get("createdTo") ?? "";
  const sort = params.get("sort") ?? "createdAt";
  const order = params.get("order") === "asc" ? "asc" : "desc";
  if (search.length > 100) return { error: "Search must not exceed 100 characters." };
  if (verificationStatus && !isAdminVerificationStatus(verificationStatus)) return { error: "Invalid verification status." };
  if (publicStatus && !isValidReportStatus(publicStatus)) return { error: "Invalid public status." };
  if (severity && !isValidReportSeverity(severity)) return { error: "Invalid severity value." };
  if (createdFrom && !Number.isFinite(Date.parse(createdFrom))) return { error: "Invalid start date." };
  if (createdTo && !Number.isFinite(Date.parse(createdTo))) return { error: "Invalid end date." };
  if (!(ADMIN_REPORT_SORTS as readonly string[]).includes(sort)) return { error: "Invalid sort field." };
  return { filters: { search, verificationStatus, publicStatus, severity, incidentId, createdFrom, createdTo, sort: sort as typeof ADMIN_REPORT_SORTS[number], order } };
}
