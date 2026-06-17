import type { IncidentReportStatus } from "./types";

export type ReportUpdateItem = {
  id: string;
  updateType: string;
  message: string;
  createdAt: string;
};

export type ReportLifecycleStatus = IncidentReportStatus | "Archived";
export type LegacyReportLifecycleStatus = "Active" | "Monitoring" | "Likely Resolved";

export type ReportRecord = {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  status: ReportLifecycleStatus | LegacyReportLifecycleStatus;
  locationName: string;
  latitude: number;
  longitude: number;
  imageUrl: string | null;
  reportedByName: string | null;
  sourceType: "Community" | "Official" | "System";
  officialSourceName?: string | null;
  officialSourceUrl?: string | null;
  officialIssuedAt?: string | null;
  officialValidUntil?: string | null;
  officialArea?: string | null;
  officialSummary?: string | null;
  confirmationCount: number;
  resolvedCount: number;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  resolvedAt: string | null;
  archivedAt: string | null;
};

export type ReportDetailRecord = ReportRecord & {
  updates: ReportUpdateItem[];
};

export type ReportsResponse = {
  data: ReportRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type ReportDetailResponse = {
  data: ReportDetailRecord;
};
