import {
  AlertCircle,
  Building2,
  CloudRain,
  Flag,
  Flame,
  Gauge,
  Home,
  Info,
  Map,
  MapPin,
  Phone,
  Shield,
  PhoneCall,
  ShieldAlert,
  Stethoscope,
  LifeBuoy,
  Users,
  Waves,
  Wind,
} from "lucide-react";

import type {
  CommunityActivityStat,
  EmergencyHotline,
  EvacuationCenter,
  EvacuationDirectoryCenter,
  FloodAlert,
  IncidentReport,
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
    icon: Phone,
    coverage: "National",
  },
  {
    id: "hotline-mmda",
    name: "MMDA Flood Control",
    number: "136",
    icon: Phone,
    coverage: "Metro Manila",
  },
  {
    id: "hotline-red-cross",
    name: "Philippine Red Cross",
    number: "143",
    icon: Phone,
    coverage: "National",
  },
  {
    id: "hotline-pagasa",
    name: "PAGASA Weather",
    number: "(02) 8927-1335",
    icon: Phone,
    coverage: "National",
  },
  {
    id: "hotline-coast-guard",
    name: "Coast Guard",
    number: "(02) 8527-8481",
    icon: Phone,
    coverage: "National",
  },
  {
    id: "hotline-marikina",
    name: "Marikina DRRMO",
    number: "(02) 8646-2436",
    icon: Phone,
    coverage: "Marikina City",
  },
  {
    id: "hotline-pasig",
    name: "Pasig City Rescue",
    number: "(02) 8643-0000",
    icon: Phone,
    coverage: "Pasig City",
  },
  {
    id: "hotline-qc",
    name: "Quezon City DRRMO",
    number: "122",
    icon: Phone,
    coverage: "Quezon City",
  },
];

export const HOTLINE_NOTICE =
  "Data is for public awareness and should be verified with official authorities such as PAGASA, NDRRMC, and your local DRRMO.";

export const COMMUNITY_ACTIVITY_STATS: CommunityActivityStat[] = [
  { id: "reports", label: "Reports Today", value: "47", icon: Flag },
  { id: "hazards", label: "Active Hazard Areas", value: "8", icon: MapPin },
  { id: "contributors", label: "Active Contributors", value: "21", icon: Users },
];

export const TRENDING_AREAS = ["Marikina", "Pasig", "Quezon City"];
export const COMMUNITY_VERIFICATION_THRESHOLD = 3;
export const RESOLVED_CONFIRMATION_THRESHOLD = 5;

export const INCIDENT_REPORTS: IncidentReport[] = [
  {
    id: "report-tumana",
    location: "Tumana Bridge, Marikina",
    coordinatesLabel: "14.6380, 121.1150",
    category: "Flooding",
    severity: "severe",
    status: "Verified by Community",
    description:
      "Water level has risen significantly. Residents are being evacuated from low-lying areas near the bridge. Heavy flow observed at the bridge entrance.",
    reportedAgo: "5 mins ago",
    reportedMinutesAgo: 5,
    confirmations: 28,
    resolvedConfirmations: 1,
    reporter: "MMDA Field Unit",
    sourceUnit: "MMDA Field Unit",
    waterLevel: "1.5m (Chest Deep)",
    photos: [
      { id: "p1", label: "Report image 1", accent: "from-sky-100 to-slate-100" },
      { id: "p2", label: "Report image 2", accent: "from-slate-100 to-blue-100" },
    ],
  },
  {
    id: "report-raymundo",
    location: "C. Raymundo Ave, Pasig",
    coordinatesLabel: "14.5760, 121.0870",
    category: "Flooding",
    severity: "high",
    status: "Verified by Community",
    description:
      "Floodwater is spreading across the lower section of the avenue. Vehicles are moving slowly and side streets are partially submerged.",
    reportedAgo: "12 mins ago",
    reportedMinutesAgo: 12,
    confirmations: 18,
    resolvedConfirmations: 2,
    reporter: "Pasig Rescue",
    sourceUnit: "Pasig Rescue",
    waterLevel: "0.9m (Waist Deep)",
    photos: [
      { id: "p1", label: "Street flooding overview", accent: "from-blue-100 to-slate-100" },
    ],
  },
  {
    id: "report-fti",
    location: "FTI Complex, Taguig",
    coordinatesLabel: "14.5150, 121.0850",
    category: "Road impassable",
    severity: "high",
    status: "Reported",
    description:
      "Main access road completely submerged. Alternative routes being used. No vehicle passage possible. Structural concerns at complex entrance.",
    reportedAgo: "24 mins ago",
    reportedMinutesAgo: 24,
    confirmations: 2,
    resolvedConfirmations: 0,
    reporter: "Anonymous",
    sourceUnit: "Anonymous",
    note: "Road impassable",
    photos: [{ id: "p1", label: "FTI entrance", accent: "from-zinc-100 to-slate-200" }],
  },
  {
    id: "report-manggahan",
    location: "Manggahan Floodway Service Road, Pasig",
    coordinatesLabel: "14.5933, 121.1078",
    category: "Flooding",
    severity: "moderate",
    status: "Resolved by Community",
    description:
      "Floodwater has receded and traffic has resumed in both directions. Community members report that the road is now passable with minor puddling.",
    reportedAgo: "46 mins ago",
    reportedMinutesAgo: 46,
    confirmations: 9,
    resolvedConfirmations: 5,
    resolvedAgo: "Resolved 12 mins ago",
    resolvedMinutesAgo: 12,
    reporter: "Barangay Watch",
    sourceUnit: "Barangay Watch",
    waterLevel: "Road clear",
    photos: [{ id: "p1", label: "Service road update", accent: "from-emerald-50 to-slate-100" }],
  },
];

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
