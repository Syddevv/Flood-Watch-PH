import { LucideIcon } from "lucide-react";

export type Theme = "light" | "dark";

export type NavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
};

export type AlertSeverity = "safe" | "moderate" | "high" | "severe";

export type FloodAlert = {
  id: string;
  title: string;
  badge: string;
  severity: AlertSeverity;
  location: string;
  waterLevel: string;
  description: string;
  updatedAt: string;
  coordinates: [number, number];
};

export type WeatherStat = {
  id: string;
  label: string;
  value: string;
  icon: LucideIcon;
};

export type WeatherOverviewData = {
  temperature: string;
  condition: string;
  icon: LucideIcon;
  stats: WeatherStat[];
};

export type WeatherMetric = {
  id: string;
  label: string;
  value: string;
  icon: LucideIcon;
  tone: "blue" | "amber" | "green" | "red";
};

export type RainfallDay = {
  day: string;
  amount: number;
};

export type EvacuationCenter = {
  id: string;
  name: string;
  distance: string;
  status: string;
  coordinates: [number, number];
};

export type EvacuationDirectoryCenter = {
  id: string;
  name: string;
  city: string;
  address: string;
  risk: AlertSeverity;
  distanceKm: number;
  travelMinutesCar: number;
  travelMinutesWalk: number;
  description: string;
  source: string;
};

export type EmergencyHotline = {
  id: string;
  name: string;
  number: string;
  icon: LucideIcon;
  coverage?: string;
  category:
    | "Emergency Response"
    | "Flood & Weather Monitoring"
    | "Medical & Health"
    | "Maritime & Water Rescue"
    | "Local DRRM Offices"
    | "Traffic"
    | "Utilities";
  filterTags: Array<
    | "National"
    | "Local Government"
    | "Flood & Weather"
    | "Medical"
    | "Rescue"
    | "Traffic"
    | "Utilities"
  >;
  serviceDescription: string;
  statusBadges: string[];
};

export type IncidentReportPhoto = {
  id: string;
  label: string;
  accent?: string;
  imageUrl?: string | null;
};

export type IncidentReportStatus =
  | "Needs More Confirmation"
  | "Confirmed by Community"
  | "Possibly Resolved"
  | "Resolved";

export type IncidentReport = {
  id: string;
  title: string;
  location: string;
  coordinatesLabel: string;
  coordinates?: [number, number];
  category: string;
  severity: AlertSeverity;
  status: IncidentReportStatus;
  description: string;
  createdAt?: string;
  reportedAgo: string;
  confirmations: number;
  resolvedConfirmations: number;
  sourceType: "Community" | "Official" | "System";
  resolvedAgo?: string;
  reporter: string;
  sourceUnit: string;
  waterLevel?: string;
  note?: string;
  photos: IncidentReportPhoto[];
};

export type CommunityActivityStat = {
  id: string;
  label: string;
  value: string;
  icon: LucideIcon;
};

export type MarkerCategory = "alert" | "center" | "hotline" | "report";

export type MapMarker = {
  id: string;
  label: string;
  category: MarkerCategory;
  severity?: AlertSeverity;
  coordinates: [number, number];
  title: string;
};

export type ReportMapMarker = {
  id: string;
  label: string;
  category: "report";
  severity: AlertSeverity;
  coordinates: [number, number];
  title: string;
  reportId: string;
  report: IncidentReport;
};

export type RiskPolygon = {
  id: string;
  severity: AlertSeverity;
  positions: [number, number][];
};

export type LegendItem = {
  id: string;
  label: string;
  severity: AlertSeverity;
};
