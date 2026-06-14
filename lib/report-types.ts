export type ReportUpdateItem = {
  id: string;
  updateType: string;
  message: string;
  createdAt: string;
};

export type ReportRecord = {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  status: string;
  locationName: string;
  latitude: number;
  longitude: number;
  imageUrl: string | null;
  reportedByName: string | null;
  sourceType: "Community" | "Official" | "System";
  confirmationCount: number;
  resolvedCount: number;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
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
