import { LucideIcon } from "lucide-react";

export type Theme = "light" | "dark";

export type NavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
};

export type AlertSeverity = "safe" | "moderate" | "high" | "severe";

export type FloodRiskLevel = "Low" | "Moderate" | "High" | "Critical";

export type SourceCategory = "official" | "community" | "system" | "provider";

export type SourceLabel =
  | "Official PAGASA Reference"
  | "Official LGU Advisory"
  | "Official NDRRMC/OCD Report"
  | "Community Report"
  | "System Weather-Based Alert";

export type OfficialSourceMetadata = {
  officialSourceName?: string;
  officialSourceUrl?: string;
  officialIssuedAt?: string;
  officialValidUntil?: string;
  officialArea?: string;
  officialSummary?: string;
};

export type SourceDescriptor = OfficialSourceMetadata & {
  category: SourceCategory;
  name: string;
  label?: SourceLabel;
  url?: string;
  note?: string;
};

export type WeatherReferenceLink = {
  id: string;
  title: string;
  url: string;
  note: string;
};

export type WeatherSourcesData = {
  dataSource: SourceDescriptor;
  officialReference: SourceDescriptor;
  advisoryMessage: string;
  shortAdvisoryMessage: string;
  links: WeatherReferenceLink[];
  labels: SourceLabel[];
};

export type FloodAlert = OfficialSourceMetadata & {
  id: string;
  title: string;
  severity: AlertSeverity;
  location: string;
  riskLevel: FloodRiskLevel;
  precipitation: number | null;
  description: string;
  updatedAt: string;
  source: SourceDescriptor;
  officialReference: SourceDescriptor;
  disclaimer: string;
};

export type WeatherLocation = OfficialSourceMetadata & {
  name: string;
  latitude: number;
  longitude: number;
  temperature: number | null;
  precipitation: number | null;
  humidity: number | null;
  windSpeed: number | null;
  condition: string | null;
  riskLevel: FloodRiskLevel;
  updatedAt: string;
  source: SourceDescriptor;
  officialReference: SourceDescriptor;
  disclaimer: string;
};

export type WeatherOverviewData = {
  locations: WeatherLocation[];
  alerts: FloodAlert[];
  fetchedAt: string;
  advisoryMessage: string;
};

export type WeatherLocationResult = {
  location: WeatherLocation;
  fetchedAt: string;
  advisoryMessage: string;
};

export type EvacuationCenterStatus =
  | "Available"
  | "Standby"
  | "Needs Verification"
  | "Temporarily Unavailable";

export type EvacuationFacility =
  | "PWD Accessible"
  | "Medical Support"
  | "Drinking Water"
  | "Restrooms"
  | "Pet Friendly"
  | "Parking";

export type EvacuationCenterResource = {
  id: string;
  name: string;
  address: string;
  barangay: string;
  cityOrMunicipality: string;
  province: string;
  latitude: number;
  longitude: number;
  status: EvacuationCenterStatus;
  facilities: EvacuationFacility[];
  contactNumber?: string;
  notes?: string;
  lastVerifiedAt: string;
  estimatedCapacity?: string;
};

export type EvacuationCenter = EvacuationCenterResource;

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

export type EmergencyContactCategory =
  | "Disaster Coordination"
  | "Weather Updates"
  | "Local Response"
  | "Barangay Hotline"
  | "Police"
  | "Fire"
  | "Ambulance";

export type EmergencyContactResource = {
  id: string;
  name: string;
  category: EmergencyContactCategory;
  phone?: string;
  coverage?: string;
  note: string;
  isSample: boolean;
  callHref?: string;
};

export type SafetyChecklistItem = {
  id: string;
  text: string;
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
  | "Likely Receded"
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
  updatedAt?: string;
  lastActivityAt?: string;
  archivedAt?: string | null;
  resolvedAt?: string | null;
  reportedAgo: string;
  lastActivityAgo?: string;
  confirmations: number;
  resolvedConfirmations: number;
  sourceType: "Community" | "Official" | "System";
  sourceCategory: Exclude<SourceCategory, "provider">;
  sourceLabel: SourceLabel;
  resolvedAgo?: string;
  reporter: string;
  sourceUnit: string;
  officialSource?: OfficialSourceMetadata;
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
  status: IncidentReportStatus;
  coordinates: [number, number];
  title: string;
  reportId: string;
  report: IncidentReport;
};

export type EvacuationCenterMapMarker = {
  id: string;
  label: string;
  category: "center";
  coordinates: [number, number];
  title: string;
  centerId: string;
  center: EvacuationCenterResource;
  status: EvacuationCenterStatus;
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
