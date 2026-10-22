import {
  AlertCircle,
  Building2,
  CloudRain,
  Flag,
  Info,
  Map,
  MapPin,
  PhoneCall,
  ShieldAlert,
  Users,
} from "lucide-react";

import type {
  CommunityActivityStat,
  IncidentReport,
  LegendItem,
  NavItem,
  RiskPolygon,
  SafetyChecklistItem,
} from "./types";
export {
  EVACUATION_CENTERS,
  EVACUATION_CENTER_DATA_STATUS_NOTE,
  EVACUATION_CENTER_FACILITIES,
  EVACUATION_CENTER_STATIC_REFERENCE_NOTE,
} from "@/data/evacuation-centers";

export const THEME_STORAGE_KEY = "floodwatch-theme";

export const NAV_ITEMS: NavItem[] = [
  { id: "flood-map", label: "Flood Map", icon: Map },
  { id: "weather-monitoring", label: "Weather Monitoring", icon: CloudRain },
  { id: "evacuation-centers", label: "Evacuation Centers", icon: Building2 },
  { id: "incident-reports", label: "Incident Reports", icon: AlertCircle },
  { id: "emergency-hotlines", label: "Emergency Hotlines", icon: PhoneCall },
  { id: "about", label: "About / How It Works", icon: Info },
];

export const FLOOD_SAFETY_CHECKLIST: SafetyChecklistItem[] = [
  {
    id: "avoid-floodwater",
    text: "Avoid walking or driving through floodwater.",
  },
  {
    id: "move-higher-ground",
    text: "Move to higher ground when water rises.",
  },
  {
    id: "turn-off-electricity",
    text: "Turn off electricity if water enters your home.",
  },
  {
    id: "prepare-go-bag",
    text: "Prepare a go-bag with food, water, medicine, flashlight, power bank, and documents.",
  },
  {
    id: "protect-documents",
    text: "Keep important documents in waterproof storage.",
  },
  {
    id: "follow-advisories",
    text: "Follow official PAGASA, NDRRMC, LGU, and barangay advisories.",
  },
  {
    id: "evacuate-early",
    text: "Evacuate early when instructed.",
  },
  {
    id: "return-when-safe",
    text: "Do not return home until authorities say it is safe.",
  },
];

export const HOTLINE_NOTICE =
  "Contact numbers may vary by location. For immediate life-threatening emergencies, contact your local emergency hotline or authorities.";

export const COMMUNITY_ACTIVITY_STATS: CommunityActivityStat[] = [
  { id: "reports", label: "Reports Today", value: "47", icon: Flag },
  { id: "hazards", label: "Active Reported Areas", value: "8", icon: MapPin },
  { id: "contributors", label: "Community Confirmations", value: "21", icon: Users },
];

export const TRENDING_AREAS = ["Marikina", "Pasig", "Quezon City"];
export const COMMUNITY_VERIFICATION_THRESHOLD = 3;
export const RESOLVED_CONFIRMATION_THRESHOLD = 3;

export const INCIDENT_REPORTS: IncidentReport[] = [];

// Risk overlays are intentionally empty until a real Calumpit hazard layer is
// available. The type, prop plumbing, and "risk overlays" toggle are kept so a
// future import can drop straight in without inventing placeholder data.
export const FLOOD_POLYGONS: RiskPolygon[] = [];

export const FLOOD_LEGEND: LegendItem[] = [
  { id: "safe", label: "Safe", severity: "safe" },
  { id: "moderate", label: "Moderate Risk", severity: "moderate" },
  { id: "high", label: "High Risk", severity: "high" },
  { id: "severe", label: "Severe Flooding", severity: "severe" },
];

export const REPORT_MARKER_LEGEND: LegendItem[] = [
  { id: "report-low", label: "Low Severity", severity: "safe" },
  { id: "report-moderate", label: "Moderate Severity", severity: "moderate" },
  { id: "report-high", label: "High Severity", severity: "high" },
  { id: "report-critical", label: "Critical Severity", severity: "severe" },
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
export const ACTIVE_ALERTS_LABEL = "Live Alerts";
export const REPORT_LABEL = "Report Flood Incident";

export const REPORT_CATEGORIES = [
  "Flood",
  "Road Blocked",
  "Rescue Needed",
  "Overflowing River",
  "Damaged Bridge",
  "Other",
  "Flooding",
  "Flooded Road",
  "Clogged Drainage",
  "Heavy Rainfall",
  "Road Not Passable",
  "Evacuation Needed",
  "Landslide Risk",
] as const;

export const REPORT_SEVERITIES = [
  "Low",
  "Moderate",
  "High",
  "Critical",
] as const;

export const REPORT_STATUSES = [
  "Needs More Confirmation",
  "Confirmed by Community",
  "Likely Receded",
  "Resolved",
  "Archived",
] as const;

export const REPORT_SOURCE_TYPES = [
  "Community",
  "Official",
  "System",
] as const;

export const CONFIRMATION_TYPES = [
  "still_active",
  "confirmed",
  "resolved",
] as const;

export const EVACUATION_CENTER_STATUSES = [
  "available",
  "standby",
  "needs_verification",
  "temporarily_unavailable",
] as const;

export const SAFETY_TIP_CATEGORIES = [
  "Before Flood",
  "During Flood",
  "After Flood",
  "Evacuation",
  "Emergency Kit",
  "Health Safety",
] as const;

export const INCIDENT_CATEGORY_OPTIONS = [
  "Flooding",
  "Flooded Road",
  "Overflowing River",
  "Clogged Drainage",
  "Heavy Rainfall",
  "Road Not Passable",
  "Evacuation Needed",
  "Landslide Risk",
  "Other",
] as const;

export const WATER_DEPTH_OPTIONS = [
  "Ankle Deep",
  "Knee Deep",
  "Waist Deep",
  "Chest Deep",
  "Not Sure",
] as const;
