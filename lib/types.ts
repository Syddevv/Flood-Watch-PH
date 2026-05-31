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

export type EmergencyHotline = {
  id: string;
  name: string;
  number: string;
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
