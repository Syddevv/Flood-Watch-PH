/**
 * Display data for the public Request Rescue view.
 *
 * Deliberately free of React and lucide imports so the node:test suite can
 * import it directly. Icons are mapped to tag ids in the component layer.
 *
 * Static display labels for the rescue form and support column. Request
 * records themselves always come from the owner-protected rescue API.
 */

export type RescueAssistanceTagId =
  | "children"
  | "elderly"
  | "pwd"
  | "pregnant"
  | "medical"
  | "none";

export type RescueAssistanceTag = {
  id: RescueAssistanceTagId;
  label: string;
  description: string;
};

/** The opt-out tag. Selecting it clears the others, and vice versa. */
export const RESCUE_NO_ASSISTANCE_TAG_ID: RescueAssistanceTagId = "none";

export const RESCUE_ASSISTANCE_TAGS: readonly RescueAssistanceTag[] = [
  {
    id: "children",
    label: "Children",
    description: "Infants or minors present",
  },
  {
    id: "elderly",
    label: "Elderly",
    description: "Senior citizens present",
  },
  {
    id: "pwd",
    label: "Person with disability",
    description: "Mobility or sensory assistance",
  },
  {
    id: "pregnant",
    label: "Pregnant person",
    description: "Expectant mother present",
  },
  {
    id: "medical",
    label: "Medical needs",
    description: "Medication or urgent care",
  },
  {
    id: RESCUE_NO_ASSISTANCE_TAG_ID,
    label: "None",
    description: "No special assistance needed",
  },
];

export const RESCUE_WAIT_TIPS: readonly string[] = [
  "Move to the highest safe point and stay there.",
  "Avoid walking or driving through floodwater.",
  "Turn off electrical mains if it is safe to do so.",
  "Keep your phone charged and volume up for callbacks.",
];

export type RescueHotlineRow = {
  id: string;
  label: string;
  number: string;
  href: string;
};

export const RESCUE_HOTLINES: readonly RescueHotlineRow[] = [
  {
    id: "rescue-hotline-911",
    label: "National Emergency",
    number: "911",
    href: "tel:911",
  },
  {
    id: "rescue-hotline-ndrrmc",
    label: "NDRRMC Operations",
    number: "(02) 8911-1406",
    href: "tel:+63289111406",
  },
  {
    id: "rescue-hotline-coast-guard",
    label: "Philippine Coast Guard",
    number: "(02) 8527-8481",
    href: "tel:+63285278481",
  },
];

export const RESCUE_HOTLINE_NOTICE =
  "For immediate, life-threatening danger, always call 911 first.";

export const RESCUE_DISCLAIMER =
  "Submitting here records a request, not a guaranteed response or dispatch. For immediate danger, call 911 and follow official advisories.";
