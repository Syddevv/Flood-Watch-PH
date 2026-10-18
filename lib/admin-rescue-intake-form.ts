import { isWithinBulacan } from "@/lib/bulacan-scope";

export type AdminRescueFields = {
  intakeMethod: "phone" | "walk_in" | "other";
  forWhom: "self" | "other";
  assistedPersonName: string;
  relationship: string;
  primaryContact: string;
  alternateContact: string;
  peopleCount: string;
  vulnerabilityTags: string[];
  vulnerabilityNotes: string;
  description: string;
  locationName: string;
  localityCode: string;
  barangay: string;
  latitude: string;
  longitude: string;
  linkedReportId: string;
  linkConsentConfirmed: boolean;
  priority: "routine" | "urgent" | "critical";
};

export const emptyAdminRescueFields: AdminRescueFields = {
  intakeMethod: "phone", forWhom: "self", assistedPersonName: "", relationship: "",
  primaryContact: "", alternateContact: "", peopleCount: "1", vulnerabilityTags: [],
  vulnerabilityNotes: "", description: "", locationName: "", localityCode: "", barangay: "",
  latitude: "", longitude: "", linkedReportId: "", linkConsentConfirmed: false, priority: "routine",
};

export function serializeAdminRescueIntake(fields: AdminRescueFields) {
  const latitude = fields.latitude.trim(), longitude = fields.longitude.trim();
  if (Boolean(latitude) !== Boolean(longitude)) throw new Error("Enter both latitude and longitude, or leave both blank.");
  const lat = latitude ? Number(latitude) : null, lon = longitude ? Number(longitude) : null;
  if (lat !== null && lon !== null && !isWithinBulacan(lat, lon)) throw new Error("The rescue point must be within Bulacan.");
  if (fields.forWhom === "other" && !fields.relationship.trim()) throw new Error("Describe the caller’s relationship to the person needing help.");
  if (fields.linkedReportId.trim() && !fields.linkConsentConfirmed) throw new Error("Review the linked report and confirm resident consent before linking it.");
  const peopleCount = Number(fields.peopleCount);
  if (!Number.isInteger(peopleCount) || peopleCount < 1 || peopleCount > 1000) throw new Error("Enter a people count from 1 to 1000.");
  return {
    intakeChannel: "admin_assisted", assistedIntakeMethod: fields.intakeMethod,
    forWhom: fields.forWhom, assistedPersonName: fields.forWhom === "other" ? fields.assistedPersonName.trim() || null : null,
    relationship: fields.forWhom === "other" ? fields.relationship.trim() : null,
    primaryContact: fields.primaryContact.trim(), alternateContact: fields.alternateContact.trim() || null,
    peopleCount, vulnerabilityTags: fields.vulnerabilityTags, vulnerabilityNotes: fields.vulnerabilityNotes.trim() || null,
    description: fields.description.trim(), locationName: fields.locationName.trim(),
    localityCode: fields.localityCode, barangay: fields.barangay.trim(),
    latitude: lat, longitude: lon, locationUncertainty: "manual",
    linkedReportId: fields.linkedReportId.trim() || null,
    linkConsentConfirmed: Boolean(fields.linkedReportId.trim()) && fields.linkConsentConfirmed,
    priority: fields.priority,
  };
}
