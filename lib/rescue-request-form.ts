import {
  OUTSIDE_BULACAN_ERROR_MESSAGE,
  isWithinBulacan,
} from "@/lib/bulacan-scope";
import type { ReportLocationSource } from "@/lib/report-location-metadata";
import {
  RESCUE_ASSISTANCE_TAGS,
  RESCUE_NO_ASSISTANCE_TAG_ID,
  type RescueAssistanceTagId,
} from "@/lib/rescue-request-data";

export const RESCUE_MIN_PEOPLE = 1;
export const RESCUE_MAX_PEOPLE = 50;
export const RESCUE_MIN_SITUATION_LENGTH = 10;
/**
 * The report API caps descriptions at 1000 characters, and the assembled
 * description adds a header plus up to three metadata lines on top of the
 * situation text. 700 leaves comfortable headroom.
 */
export const RESCUE_MAX_SITUATION_LENGTH = 700;
export const RESCUE_MAX_LOCATION_NAME_LENGTH = 160;
export const RESCUE_MAX_CONTACT_LENGTH = 40;

export type RescueRequestSubmission = {
  forWhom: "self" | "other";
  assistedPersonName: string;
  relationship: string;
  alternateContact: string;
  localityCode: string;
  barangay: string;
  linkedReportId: string;
  locationName: string;
  latitude: string;
  longitude: string;
  locationSource: ReportLocationSource;
  gpsAccuracyMeters: number | null;
  peopleCount: number;
  assistanceTagIds: RescueAssistanceTagId[];
  situation: string;
  contactNumber: string;
};

export function serializeRescueSubmission(submission: RescueRequestSubmission) {
  return {
    forWhom: submission.forWhom,
    assistedPersonName: submission.assistedPersonName.trim() || null,
    relationship: submission.relationship.trim() || null,
    primaryContact: submission.contactNumber.trim(),
    alternateContact: submission.alternateContact.trim() || null,
    peopleCount: submission.peopleCount,
    vulnerabilityTags: submission.assistanceTagIds.filter((tag) => tag !== "none"),
    description: submission.situation.trim(),
    locationName: submission.locationName.trim(),
    latitude: submission.latitude.trim() ? Number(submission.latitude) : null,
    longitude: submission.longitude.trim() ? Number(submission.longitude) : null,
    locationUncertainty: submission.locationSource === "gps" && submission.latitude.trim() && submission.longitude.trim()
      ? "gps" : submission.locationSource === "manual" ? "manual" : submission.latitude.trim() && submission.longitude.trim() ? "map" : "manual",
    localityCode: submission.localityCode,
    barangay: submission.barangay.trim(),
    linkedReportId: submission.linkedReportId.trim() || null,
  };
}

export function clampRescuePeopleCount(value: number): number {
  if (!Number.isFinite(value)) {
    return RESCUE_MIN_PEOPLE;
  }

  return Math.min(RESCUE_MAX_PEOPLE, Math.max(RESCUE_MIN_PEOPLE, Math.floor(value)));
}

export function formatRescuePeopleLabel(count: number): string {
  return count === 1 ? "1 person" : `${count} people`;
}

/**
 * "None" and the real needs are mutually exclusive: a request that claims both
 * no special assistance and an infant on board tells a responder nothing.
 */
export function toggleRescueAssistanceTag(
  selected: RescueAssistanceTagId[],
  tagId: RescueAssistanceTagId,
): RescueAssistanceTagId[] {
  if (selected.includes(tagId)) {
    return selected.filter((id) => id !== tagId);
  }

  if (tagId === RESCUE_NO_ASSISTANCE_TAG_ID) {
    return [RESCUE_NO_ASSISTANCE_TAG_ID];
  }

  return [...selected.filter((id) => id !== RESCUE_NO_ASSISTANCE_TAG_ID), tagId];
}

/** Renders selected tags in their defined order, not click order. */
export function describeRescueAssistanceTags(ids: RescueAssistanceTagId[]): string {
  return RESCUE_ASSISTANCE_TAGS.filter((tag) => ids.includes(tag.id))
    .map((tag) => tag.label)
    .join(", ");
}

export type RescueDescriptionInput = {
  situation: string;
  peopleCount: number;
  assistanceTagIds: RescueAssistanceTagId[];
  contactNumber: string;
};

export function buildRescueRequestDescription({
  situation,
  peopleCount,
  assistanceTagIds,
  contactNumber,
}: RescueDescriptionInput): string {
  const assistance = describeRescueAssistanceTags(assistanceTagIds);
  const contact = contactNumber.trim();

  return [
    "RESCUE REQUEST",
    situation.trim(),
    `People needing assistance: ${peopleCount}`,
    assistance ? `Special assistance: ${assistance}` : "",
    contact ? `Contact number: ${contact}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export type RescueValidationInput = {
  locationName: string;
  latitude: string;
  longitude: string;
  situation: string;
  allowManual?: boolean;
};

/** Returns the first blocking problem, or null when the form can be sent. */
export function validateRescueRequestForm({
  locationName,
  latitude,
  longitude,
  situation,
  allowManual = false,
}: RescueValidationInput): string | null {
  const trimmedLocationName = locationName.trim();

  if (!trimmedLocationName) {
    return "Add the location where help is needed.";
  }

  if (trimmedLocationName.length > RESCUE_MAX_LOCATION_NAME_LENGTH) {
    return `Location must not exceed ${RESCUE_MAX_LOCATION_NAME_LENGTH} characters.`;
  }

  const parsedLatitude = Number(latitude);
  const parsedLongitude = Number(longitude);

  if (
    (!allowManual && (latitude.trim() === "" || longitude.trim() === "")) ||
    (Boolean(latitude.trim()) !== Boolean(longitude.trim())) ||
    (Boolean(latitude.trim()) && !Number.isFinite(parsedLatitude)) ||
    (Boolean(longitude.trim()) && !Number.isFinite(parsedLongitude))
  ) {
    return "Pin your location with your current location or the map so responders can reach you.";
  }

  // Same rule the server enforces, checked here so the user is not told to
  // wait on a request that was never going to be accepted.
  if (latitude.trim() && longitude.trim() && !isWithinBulacan(parsedLatitude, parsedLongitude)) {
    return OUTSIDE_BULACAN_ERROR_MESSAGE;
  }

  if (situation.trim().length < RESCUE_MIN_SITUATION_LENGTH) {
    return `Describe your situation in at least ${RESCUE_MIN_SITUATION_LENGTH} characters so responders know what to prepare.`;
  }

  if (situation.trim().length > RESCUE_MAX_SITUATION_LENGTH) {
    return `Situation must not exceed ${RESCUE_MAX_SITUATION_LENGTH} characters.`;
  }

  return null;
}
