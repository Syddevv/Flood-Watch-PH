import {
  AlertCircle,
  Building2,
  CloudRain,
  Flame,
  Gauge,
  Home,
  Info,
  Map,
  Shield,
  PhoneCall,
  ShieldAlert,
  Stethoscope,
  LifeBuoy,
  Waves,
  Wind,
} from "lucide-react";

import type {
  EmergencyHotline,
  EvacuationCenter,
  FloodAlert,
  LegendItem,
  MapMarker,
  NavItem,
  RiskPolygon,
  WeatherOverviewData,
} from "./types";

export const THEME_STORAGE_KEY = "floodwatch-theme";

export const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "flood-map", label: "Flood Map", icon: Map },
  { id: "weather-monitoring", label: "Weather Monitoring", icon: CloudRain },
  { id: "evacuation-centers", label: "Evacuation Centers", icon: Building2 },
  { id: "incident-reports", label: "Incident Reports", icon: AlertCircle },
  { id: "emergency-hotlines", label: "Emergency Hotlines", icon: PhoneCall },
  { id: "about", label: "About / How It Works", icon: Info },
];

export const ACTIVE_ALERTS: FloodAlert[] = [
  {
    id: "alert-marikina",
    title: "Severe Flood Alert",
    badge: "Severe Flooding",
    severity: "severe",
    location: "Marikina River Basin",
    waterLevel: "18.4 m",
    description:
      "Water has breached the second alarm. Residents in low-lying areas must evacuate now.",
    updatedAt: "5 mins ago",
    coordinates: [14.6407, 121.1029],
  },
  {
    id: "alert-pasig",
    title: "High Flood Risk",
    badge: "High Risk",
    severity: "high",
    location: "Pasig - Cainta",
    waterLevel: "1.2 m",
    description:
      "Rising waters along C. Raymundo Ave. Avoid the area and prepare to relocate.",
    updatedAt: "12 mins ago",
    coordinates: [14.5869, 121.1038],
  },
  {
    id: "alert-qc",
    title: "Moderate Flood Watch",
    badge: "Moderate Risk",
    severity: "moderate",
    location: "Quezon City North",
    waterLevel: "0.3 m",
    description:
      "Street-level flooding reported on Commonwealth Ave. Drive with caution.",
    updatedAt: "38 mins ago",
    coordinates: [14.7004, 121.0744],
  },
];

export const WEATHER_OVERVIEW: WeatherOverviewData = {
  temperature: "27°C",
  condition: "Heavy Rain",
  icon: CloudRain,
  stats: [
    { id: "humidity", label: "Humidity", value: "92%", icon: Waves },
    { id: "wind", label: "Wind", value: "38 km/h", icon: Wind },
    { id: "rain", label: "Rain", value: "95%", icon: Gauge },
  ],
};

export const EVACUATION_CENTERS: EvacuationCenter[] = [
  {
    id: "marikina-sports",
    name: "Marikina Sports Complex",
    distance: "1.2 km away",
    status: "Open",
    coordinates: [14.6345, 121.102],
  },
  {
    id: "qc-circle",
    name: "Quezon City Memorial Circle",
    distance: "4.8 km away",
    status: "Open",
    coordinates: [14.6512, 121.0493],
  },
  {
    id: "pasig-school",
    name: "Pasig Elementary School",
    distance: "3.4 km away",
    status: "Open",
    coordinates: [14.5764, 121.0851],
  },
];

export const EMERGENCY_HOTLINES: EmergencyHotline[] = [
  {
    id: "hotline-police",
    name: "Police",
    number: "117",
    icon: Shield,
  },
  {
    id: "hotline-fire",
    name: "Fire Department",
    number: "160",
    icon: Flame,
  },
  {
    id: "hotline-rescue",
    name: "Rescue Team",
    number: "911",
    icon: LifeBuoy,
  },
  {
    id: "hotline-medical",
    name: "Medical Emergency",
    number: "143",
    icon: Stethoscope,
  },
];

export const HOTLINE_NOTICE =
  "Data is for public awareness and should be verified with official authorities such as PAGASA, NDRRMC, and your local DRRMO.";

export const MAP_MARKERS: MapMarker[] = [
  {
    id: "marker-severe-1",
    label: "1",
    category: "alert",
    severity: "severe",
    coordinates: [14.651, 121.093],
    title: "Severe Flood Alert",
  },
  {
    id: "marker-alert-2",
    label: "F",
    category: "alert",
    severity: "high",
    coordinates: [14.5995, 121.0736],
    title: "High Flood Risk",
  },
  {
    id: "marker-alert-3",
    label: "F",
    category: "alert",
    severity: "moderate",
    coordinates: [14.6268, 121.0422],
    title: "Moderate Flood Watch",
  },
  {
    id: "marker-center-1",
    label: "P",
    category: "center",
    coordinates: [14.6353, 121.1016],
    title: "Marikina Sports Complex",
  },
  {
    id: "marker-center-2",
    label: "H",
    category: "center",
    coordinates: [14.5767, 121.0857],
    title: "Pasig Elementary School",
  },
  {
    id: "marker-center-3",
    label: "H",
    category: "center",
    coordinates: [14.6536, 121.0518],
    title: "Quezon City Memorial Circle",
  },
  {
    id: "marker-hotline-1",
    label: "E",
    category: "hotline",
    coordinates: [14.5608, 121.0551],
    title: "Emergency Hotline",
  },
  {
    id: "marker-hotline-2",
    label: "E",
    category: "hotline",
    coordinates: [14.6784, 121.0447],
    title: "Rescue Coordination",
  },
  {
    id: "marker-hotline-3",
    label: "E",
    category: "hotline",
    coordinates: [14.5942, 121.1235],
    title: "Hotline Dispatch",
  },
];

export const FLOOD_POLYGONS: RiskPolygon[] = [
  {
    id: "poly-marikina",
    severity: "severe",
    positions: [
      [14.6595, 121.0912],
      [14.6481, 121.1114],
      [14.6283, 121.1141],
      [14.6208, 121.0952],
      [14.6347, 121.0819],
    ],
  },
  {
    id: "poly-pasig",
    severity: "high",
    positions: [
      [14.5952, 121.0737],
      [14.5885, 121.1023],
      [14.5655, 121.1112],
      [14.5559, 121.0858],
      [14.5721, 121.0665],
    ],
  },
  {
    id: "poly-qc",
    severity: "moderate",
    positions: [
      [14.6897, 121.0364],
      [14.7068, 121.0749],
      [14.6859, 121.088],
      [14.6686, 121.0515],
    ],
  },
];

export const FLOOD_LEGEND: LegendItem[] = [
  { id: "safe", label: "Safe", severity: "safe" },
  { id: "moderate", label: "Moderate Risk", severity: "moderate" },
  { id: "high", label: "High Risk", severity: "high" },
  { id: "severe", label: "Severe Flooding", severity: "severe" },
];

export const SIGNAL_CARD = {
  title: "Signal No. 3",
  description: "Tropical storm warning active for Metro Manila & Rizal.",
  icon: ShieldAlert,
};

export const HEADER_SUBTITLE = "Public Flood Monitoring";
export const SEARCH_PLACEHOLDER =
  "Search location, city, evacuation center...";
export const LIVE_TIMESTAMP = "Today, 8:45 PM PHT";
export const ACTIVE_ALERTS_LABEL = "3 Active Alerts";
export const REPORT_LABEL = "Report Flood Incident";
