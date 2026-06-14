import {
  AlertCircle,
  Building2,
  CloudRain,
  Flag,
  Info,
  LifeBuoy,
  Map,
  MapPin,
  Phone,
  Shield,
  PhoneCall,
  ShieldAlert,
  Stethoscope,
  Users,
} from "lucide-react";

import type {
  CommunityActivityStat,
  EmergencyHotline,
  EvacuationCenter,
  EvacuationDirectoryCenter,
  IncidentReport,
  LegendItem,
  MapMarker,
  NavItem,
  RiskPolygon,
} from "./types";

export const THEME_STORAGE_KEY = "floodwatch-theme";

export const NAV_ITEMS: NavItem[] = [
  { id: "flood-map", label: "Flood Map", icon: Map },
  { id: "weather-monitoring", label: "Weather Monitoring", icon: CloudRain },
  { id: "evacuation-centers", label: "Evacuation Centers", icon: Building2 },
  { id: "incident-reports", label: "Incident Reports", icon: AlertCircle },
  { id: "emergency-hotlines", label: "Emergency Hotlines", icon: PhoneCall },
  { id: "about", label: "About / How It Works", icon: Info },
];

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

export const EVACUATION_DIRECTORY_CENTERS: EvacuationDirectoryCenter[] = [
  {
    id: "marikina-sports-complex",
    name: "Marikina Sports Complex",
    city: "Marikina",
    address: "Shoe Ave, Marikina City",
    risk: "severe",
    distanceKm: 1.2,
    travelMinutesCar: 3,
    travelMinutesWalk: 15,
    description: "High flood risk in surrounding area. Area is near Marikina River.",
    source: "PAGASA",
  },
  {
    id: "pasig-elementary-school",
    name: "Pasig Elementary School",
    city: "Pasig",
    address: "A. Mabini St, Pasig City",
    risk: "high",
    distanceKm: 2.8,
    travelMinutesCar: 8,
    travelMinutesWalk: 35,
    description: "Some nearby roads may be flooded during heavy rains.",
    source: "LGU",
  },
  {
    id: "cainta-community-center",
    name: "Cainta Community Center",
    city: "Cainta",
    address: "Ortigas Ext, Cainta, Rizal",
    risk: "safe",
    distanceKm: 3.4,
    travelMinutesCar: 10,
    travelMinutesWalk: 43,
    description: "Nearby roads are passable. Center is on higher ground.",
    source: "PAGASA",
  },
  {
    id: "qc-hall-multi-purpose",
    name: "QC Hall Multi-Purpose",
    city: "Quezon City",
    address: "Elliptical Rd, Quezon City",
    risk: "moderate",
    distanceKm: 4.1,
    travelMinutesCar: 12,
    travelMinutesWalk: 52,
    description: "Nearby roads are mostly passable. Low elevation areas may have minor flooding.",
    source: "Community Reports",
  },
  {
    id: "taguig-covered-court",
    name: "Taguig Covered Court",
    city: "Taguig",
    address: "Gen. Luna St, Taguig City",
    risk: "high",
    distanceKm: 6.5,
    travelMinutesCar: 18,
    travelMinutesWalk: 82,
    description: "Nearby roads may experience flooding. Center location is on elevated ground.",
    source: "LGU",
  },
];

export const EMERGENCY_HOTLINES: EmergencyHotline[] = [
  {
    id: "hotline-ndrrmc",
    name: "NDRRMC Operations Center",
    number: "(02) 8911-1406",
    icon: Shield,
    coverage: "National",
    category: "Emergency Response",
    filterTags: ["National", "Rescue"],
    serviceDescription:
      "National disaster response coordination, emergency escalation, and incident reporting.",
    statusBadges: ["Available 24/7", "National Service"],
  },
  {
    id: "hotline-mmda",
    name: "MMDA Flood Control",
    number: "136",
    icon: Phone,
    coverage: "Metro Manila",
    category: "Flood & Weather Monitoring",
    filterTags: ["Flood & Weather", "Traffic"],
    serviceDescription:
      "Flood monitoring, drainage concerns, and flooded road reports across major NCR routes.",
    statusBadges: ["Available 24/7", "Metro Manila Service"],
  },
  {
    id: "hotline-red-cross",
    name: "Philippine Red Cross",
    number: "143",
    icon: Stethoscope,
    coverage: "National",
    category: "Medical & Health",
    filterTags: ["National", "Medical", "Rescue"],
    serviceDescription:
      "Emergency medical assistance, ambulance support, blood services, and humanitarian response.",
    statusBadges: ["Available 24/7", "Emergency Hotline"],
  },
  {
    id: "hotline-pagasa",
    name: "PAGASA Weather",
    number: "(02) 8927-1335",
    icon: CloudRain,
    coverage: "National",
    category: "Flood & Weather Monitoring",
    filterTags: ["National", "Flood & Weather"],
    serviceDescription:
      "Weather advisories, rainfall warnings, flood outlooks, and storm updates.",
    statusBadges: ["Available 24/7", "National Service"],
  },
  {
    id: "hotline-coast-guard",
    name: "Coast Guard",
    number: "(02) 8527-8481",
    icon: LifeBuoy,
    coverage: "National",
    category: "Maritime & Water Rescue",
    filterTags: ["National", "Rescue"],
    serviceDescription:
      "Maritime rescue, coastal emergency response, and water search coordination.",
    statusBadges: ["Available 24/7", "National Service"],
  },
  {
    id: "hotline-doh",
    name: "Department of Health",
    number: "(02) 8651-7800",
    icon: Stethoscope,
    coverage: "National",
    category: "Medical & Health",
    filterTags: ["National", "Medical"],
    serviceDescription:
      "Health emergency coordination, hospital referral guidance, and public health support.",
    statusBadges: ["Available 24/7", "National Service"],
  },
  {
    id: "hotline-marikina",
    name: "Marikina DRRMO",
    number: "(02) 8646-2436",
    icon: Phone,
    coverage: "Marikina City",
    category: "Local DRRM Offices",
    filterTags: ["Local Government", "Rescue"],
    serviceDescription:
      "Local flood response, evacuation assistance, rescue dispatch, and barangay coordination.",
    statusBadges: ["Available 24/7", "Local Government"],
  },
  {
    id: "hotline-pasig",
    name: "Pasig City Rescue",
    number: "(02) 8643-0000",
    icon: Phone,
    coverage: "Pasig City",
    category: "Local DRRM Offices",
    filterTags: ["Local Government", "Rescue"],
    serviceDescription:
      "Urban rescue operations, emergency transport, and flood-related assistance in Pasig.",
    statusBadges: ["Available 24/7", "Local Government"],
  },
  {
    id: "hotline-qc",
    name: "Quezon City DRRMO",
    number: "122",
    icon: Phone,
    coverage: "Quezon City",
    category: "Local DRRM Offices",
    filterTags: ["Local Government", "Rescue"],
    serviceDescription:
      "City disaster response, incident dispatch, evacuation support, and emergency coordination.",
    statusBadges: ["Available 24/7", "Local Government"],
  },
  {
    id: "hotline-meralco",
    name: "Meralco Emergency",
    number: "16211",
    icon: PhoneCall,
    coverage: "NCR",
    category: "Utilities",
    filterTags: ["Utilities"],
    serviceDescription:
      "Power outage reporting, electrical hazards, and damaged line concerns during severe weather.",
    statusBadges: ["Emergency Hotline", "Utility Service"],
  },
];

export const HOTLINE_NOTICE =
  "Data is for public awareness and should be verified with official authorities such as PAGASA, NDRRMC, and your local DRRMO.";

export const COMMUNITY_ACTIVITY_STATS: CommunityActivityStat[] = [
  { id: "reports", label: "Reports Today", value: "47", icon: Flag },
  { id: "hazards", label: "Active Reported Areas", value: "8", icon: MapPin },
  { id: "contributors", label: "Community Confirmations", value: "21", icon: Users },
];

export const TRENDING_AREAS = ["Marikina", "Pasig", "Quezon City"];
export const COMMUNITY_VERIFICATION_THRESHOLD = 3;
export const RESOLVED_CONFIRMATION_THRESHOLD = 3;

export const INCIDENT_REPORTS: IncidentReport[] = [];

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
  "Active",
  "Monitoring",
  "Possibly Resolved",
  "Resolved",
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
  "Open",
  "Standby",
  "Full",
  "Closed",
  "Unknown",
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
