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
  EmergencyContactResource,
  EmergencyHotline,
  EvacuationCenter,
  EvacuationFacility,
  IncidentReport,
  LegendItem,
  MapMarker,
  NavItem,
  RiskPolygon,
  SafetyChecklistItem,
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

export const EVACUATION_CENTER_FACILITIES: EvacuationFacility[] = [
  "PWD Accessible",
  "Medical Support",
  "Drinking Water",
  "Restrooms",
  "Pet Friendly",
  "Parking",
];

export const EVACUATION_CENTERS: EvacuationCenter[] = [
  {
    id: "marikina-sports-complex",
    name: "Marikina Sports Complex",
    address: "Sumulong Highway, Marikina City",
    barangay: "Sto. Nino",
    cityOrMunicipality: "Marikina City",
    province: "Metro Manila",
    latitude: 14.6353,
    longitude: 121.1016,
    status: "Available",
    facilities: ["Medical Support", "Drinking Water", "Restrooms", "Parking"],
    contactNumber: "(02) 8646-2436",
    notes: "Primary evacuation venue for nearby river communities.",
    lastVerifiedAt: "2026-06-12T08:30:00+08:00",
    estimatedCapacity: "600 people",
  },
  {
    id: "quezon-city-memorial-circle",
    name: "Quezon City Memorial Circle Evacuation Area",
    address: "Elliptical Road, Diliman, Quezon City",
    barangay: "Diliman",
    cityOrMunicipality: "Quezon City",
    province: "Metro Manila",
    latitude: 14.6512,
    longitude: 121.0493,
    status: "Standby",
    facilities: ["PWD Accessible", "Restrooms", "Pet Friendly", "Parking"],
    contactNumber: "(02) 8988-4242",
    notes: "Standby venue for overflow shelter operations during prolonged rainfall.",
    lastVerifiedAt: "2026-06-10T14:15:00+08:00",
    estimatedCapacity: "450 people",
  },
  {
    id: "pasig-rainforest-site",
    name: "Pasig Rainforest Evacuation Site",
    address: "F. Legaspi Bridge, Pasig City",
    barangay: "Santolan",
    cityOrMunicipality: "Pasig City",
    province: "Metro Manila",
    latitude: 14.5767,
    longitude: 121.0857,
    status: "Needs Verification",
    facilities: ["Drinking Water", "Restrooms", "Parking"],
    contactNumber: "(02) 8643-0000",
    notes: "Availability should be confirmed with the city DRRMO before deployment.",
    lastVerifiedAt: "2026-06-08T11:00:00+08:00",
  },
  {
    id: "cainta-covered-court",
    name: "Cainta Covered Court Shelter",
    address: "Ortigas Avenue Extension, Cainta, Rizal",
    barangay: "San Isidro",
    cityOrMunicipality: "Cainta",
    province: "Rizal",
    latitude: 14.5869,
    longitude: 121.1228,
    status: "Available",
    facilities: ["PWD Accessible", "Medical Support", "Drinking Water", "Restrooms"],
    notes: "Community shelter on elevated ground for nearby households.",
    lastVerifiedAt: "2026-06-11T16:45:00+08:00",
    estimatedCapacity: "300 people",
  },
  {
    id: "taguig-covered-court",
    name: "Taguig Covered Court Evacuation Center",
    address: "General Luna Street, Taguig City",
    barangay: "Tuktukan",
    cityOrMunicipality: "Taguig City",
    province: "Metro Manila",
    latitude: 14.5248,
    longitude: 121.0509,
    status: "Temporarily Unavailable",
    facilities: ["Restrooms", "Parking"],
    contactNumber: "(02) 8642-3582",
    notes: "Under maintenance. Confirm alternate shelter assignment with the LGU.",
    lastVerifiedAt: "2026-06-09T09:20:00+08:00",
  },
  {
    id: "malanday-elementary-school",
    name: "Malanday Elementary School Shelter",
    address: "JP Rizal Street, Malanday, Marikina City",
    barangay: "Malanday",
    cityOrMunicipality: "Marikina City",
    province: "Metro Manila",
    latitude: 14.6712,
    longitude: 121.0982,
    status: "Standby",
    facilities: ["PWD Accessible", "Drinking Water", "Restrooms", "Pet Friendly"],
    notes: "Prepared for barangay-level evacuation if river level advisories worsen.",
    lastVerifiedAt: "2026-06-13T07:50:00+08:00",
    estimatedCapacity: "220 people",
  },
];

export const EMERGENCY_RESOURCE_CONTACTS: EmergencyContactResource[] = [
  {
    id: "resource-ndrrmc",
    name: "NDRRMC Operations Center",
    category: "Disaster Coordination",
    phone: "(02) 8911-1406",
    coverage: "National",
    note: "National disaster coordination and emergency escalation.",
    isSample: false,
    callHref: "tel:+63289111406",
  },
  {
    id: "resource-pagasa",
    name: "PAGASA Weather Updates",
    category: "Weather Updates",
    phone: "(02) 8927-1335",
    coverage: "National",
    note: "Official weather advisories, rainfall warnings, and storm updates.",
    isSample: false,
    callHref: "tel:+63289271335",
  },
  {
    id: "resource-local-drrmo",
    name: "Local DRRMO Desk",
    category: "Local Response",
    phone: "(02) 8646-2436",
    coverage: "City / Municipal",
    note: "Use the listed number for your city DRRMO or confirm your local equivalent.",
    isSample: true,
    callHref: "tel:+63286462436",
  },
  {
    id: "resource-barangay",
    name: "Barangay Hotline",
    category: "Barangay Hotline",
    phone: "0917-000-0000",
    coverage: "Barangay-level",
    note: "Sample/demo hotline. Replace with the active barangay emergency contact.",
    isSample: true,
    callHref: "tel:09170000000",
  },
  {
    id: "resource-police",
    name: "Philippine National Police",
    category: "Police",
    phone: "117",
    coverage: "National",
    note: "Emergency police assistance and incident coordination.",
    isSample: false,
    callHref: "tel:117",
  },
  {
    id: "resource-fire",
    name: "Bureau of Fire Protection",
    category: "Fire",
    phone: "(02) 8426-0219",
    coverage: "National",
    note: "Fire response, rescue dispatch, and incident support.",
    isSample: false,
    callHref: "tel:+63284260219",
  },
  {
    id: "resource-ambulance",
    name: "Ambulance / Medical Response",
    category: "Ambulance",
    phone: "143",
    coverage: "National",
    note: "Sample routing via Philippine Red Cross and partner responders.",
    isSample: true,
    callHref: "tel:143",
  },
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
  "Likely Resolved",
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
  "Available",
  "Standby",
  "Needs Verification",
  "Temporarily Unavailable",
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
