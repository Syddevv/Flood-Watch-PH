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
};

export type IncidentReportPhoto = {
  id: string;
  label: string;
  accent: string;
};

export type IncidentReportStatus =
  | "Reported"
  | "Verified by Community"
  | "Resolved by Community";

export type IncidentReport = {
  id: string;
  location: string;
  coordinatesLabel: string;
  category: string;
  severity: AlertSeverity;
  status: IncidentReportStatus;
  description: string;
  reportedAgo: string;
  reportedMinutesAgo: number;
  confirmations: number;
  resolvedConfirmations: number;
  resolvedAgo?: string;
  resolvedMinutesAgo?: number;
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

export type MarkerCategory = "alert" | "center" | "hotline";

export type MapMarker = {
  id: string;
  label: string;
  category: MarkerCategory;
  severity?: AlertSeverity;
  coordinates: [number, number];
  title: string;
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
