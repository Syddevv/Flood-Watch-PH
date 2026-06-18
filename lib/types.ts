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
  resolvedAddress?: string;
};

export type EvacuationCenterStatus =
  | "available"
  | "standby"
  | "needs_verification"
  | "temporarily_unavailable";

export type EvacuationCenterVerificationStatus =
  | "verified"
  | "needs_verification"
  | "sample_demo"
  | "outdated";

export type EvacuationCenterSourceType =
  | "official_dswd"
  | "official_lgu"
  | "openstreetmap"
  | "community_reference"
  | "sample_demo";

export type EvacuationFacility =
  | "pwd_accessible"
  | "medical_support"
  | "drinking_water"
  | "restrooms"
  | "pet_friendly"
  | "parking";

export type EvacuationCenterResource = {
  id: string;
  name: string;
  address: string;
  barangay?: string;
  city: string;
  province: string;
  region?: string;
  latitude: number;
  longitude: number;
  status: EvacuationCenterStatus;
  verificationStatus: EvacuationCenterVerificationStatus;
  facilities: EvacuationFacility[];
  estimatedCapacity?: number;
  contactNumber?: string;
  sourceType: EvacuationCenterSourceType;
  sourceName?: string;
  sourceUrl?: string;
  lastVerifiedAt?: string;
  notes?: string;
  isSample?: boolean;
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
  sourceType: "official_national" | "official_lgu" | "sample_demo";
  sourceName?: string;
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
  lastConfirmedAt?: string | null;
  lastResolvedConfirmationAt?: string | null;
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
