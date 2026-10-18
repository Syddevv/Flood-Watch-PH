/**
 * Display data for the public Request Rescue view.
 *
 * Deliberately free of React and lucide imports so the node:test suite can
 * import it directly. Icons are mapped to tag ids in the component layer.
 *
 * The request list is sample data: there is no RescueRequest model yet, and
 * components/admin-rescue-requests.tsx is still on preview data too. Everything
 * here is scoped to Calumpit, Bulacan, matching the rest of the app.
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

export const RESCUE_TIMELINE_STAGES = [
  "Request Received",
  "Team Dispatched",
  "Team En Route",
  "Team On Scene",
  "Rescue Complete",
] as const;

export type RescueTimelineStage = (typeof RESCUE_TIMELINE_STAGES)[number];

/** `time: null` renders as "Pending" - the stage has not happened yet. */
export type RescueTimelineEntry = {
  stage: RescueTimelineStage;
  time: string | null;
  detail: string | null;
};

export type RescueRequestRecord = {
  id: string;
  statusLabel: string;
  complete: boolean;
  locationName: string;
  peopleCount: number;
  submittedLabel: string;
  assignedTeam: string | null;
  assistanceTagIds: RescueAssistanceTagId[];
  description: string;
  timeline: RescueTimelineEntry[];
};

/**
 * Timeline for a request that was just filed: stage one is stamped, the rest
 * wait on a responder.
 */
export function buildPendingTimeline(receivedTime: string): RescueTimelineEntry[] {
  return RESCUE_TIMELINE_STAGES.map((stage, index) =>
    index === 0
      ? {
          stage,
          time: receivedTime,
          detail: "Request logged by response center.",
        }
      : { stage, time: null, detail: null },
  );
}

export const SAMPLE_RESCUE_REQUESTS: RescueRequestRecord[] = [
  {
    id: "RR-2409-0142",
    statusLabel: "Team En Route",
    complete: false,
    locationName: "Blk 7 Lot 12, Brgy. Meysulao, Calumpit",
    peopleCount: 4,
    submittedLabel: "Today, 3:42 PM",
    assignedTeam: "Calumpit Rescue 4",
    assistanceTagIds: ["children", "elderly"],
    description:
      "Water is at chest level on the ground floor. We moved to the second floor with two young children and my grandmother. Current is strong outside.",
    timeline: [
      {
        stage: "Request Received",
        time: "3:42 PM",
        detail: "Request logged by response center.",
      },
      {
        stage: "Team Dispatched",
        time: "3:48 PM",
        detail: "Calumpit Rescue 4 assigned.",
      },
      {
        stage: "Team En Route",
        time: "3:55 PM",
        detail: "Boat team traveling via Calumpit-Hagonoy Road.",
      },
      { stage: "Team On Scene", time: null, detail: null },
      { stage: "Rescue Complete", time: null, detail: null },
    ],
  },
  {
    id: "RR-2409-0087",
    statusLabel: "Rescue Complete",
    complete: true,
    locationName: "Riverside Ext., Brgy. Longos, Calumpit",
    peopleCount: 2,
    submittedLabel: "Today, 1:10 PM",
    assignedTeam: "Calumpit MDRRMO Unit 2",
    assistanceTagIds: ["medical"],
    description:
      "Elderly neighbor needs dialysis medication. Water rising slowly, still passable but road access limited.",
    timeline: [
      {
        stage: "Request Received",
        time: "1:10 PM",
        detail: "Request logged by response center.",
      },
      {
        stage: "Team Dispatched",
        time: "1:19 PM",
        detail: "Calumpit MDRRMO Unit 2 assigned.",
      },
      {
        stage: "Team En Route",
        time: "1:31 PM",
        detail: "Unit traveling via Poblacion route.",
      },
      {
        stage: "Team On Scene",
        time: "1:52 PM",
        detail: "Responders reached the household.",
      },
      {
        stage: "Rescue Complete",
        time: "2:14 PM",
        detail: "Both residents brought to the barangay evacuation center.",
      },
    ],
  },
];

export const RESCUE_WAIT_TIPS: readonly string[] = [
  "Move to the highest safe point and stay there.",
  "Avoid walking or driving through floodwater.",
  "Turn off electrical mains if it is safe to do so.",
  "Keep your phone charged and volume up for callbacks.",
];

export const RESCUE_HOTLINE_NOTICE =
  "For immediate, life-threatening danger, call an official emergency service first. This form does not dispatch responders.";

export const RESCUE_DISCLAIMER =
  "This is a community-assist tool. Requests are prioritized by responders based on severity and available units. Always follow official advisories from PAGASA, NDRRMC, and your LGU.";
