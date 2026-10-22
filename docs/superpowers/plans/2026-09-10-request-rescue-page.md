> Retired — Rescue Request and Responder Dispatch features removed from active scope. Historical planning or rollout notes below are retained for reference; see [retirement status](../../rescue-retirement.md).

# Request Rescue Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public **Request Rescue** view at `/rescue-request` that reproduces the supplied UI reference — a guided rescue-request form, a "My Rescue Requests" list with status timelines, and a supporting aside — fully responsive and built only from the app's existing design tokens.

**Architecture:** The page is a content-only `DashboardShell` view, exactly like Incident Reports. All pure logic (people-count clamping, assistance-tag toggling, description assembly, form validation) lives in two React-free modules under `lib/` that are unit-tested with `node:test`. Four focused client components under `components/` render the page and are covered by a Playwright browser spec. Submission reuses the existing `POST /api/reports` endpoint with category `Rescue Needed`; the request list is sample data, since no `RescueRequest` Prisma model exists yet.

**Tech Stack:** Next.js (App Router), React 19 client components, TypeScript, Tailwind CSS v4 with CSS-variable tokens, `lucide-react` icons, `node:test` via `tsx` for unit tests, Playwright for browser tests, Prisma/`@prisma/client` (untouched by this plan).

**Spec:** `docs/superpowers/specs/2026-09-10-request-rescue-page-design.md`

## Global Constraints

- **Styling uses existing tokens only.** No new CSS variables, no hardcoded hex colours except where a sibling component already does so. Use `--color-surface`, `--color-panel`, `--color-border`, `--color-primary`, `--color-foreground`, `--color-muted-foreground`, `--color-background`, and the `--color-danger*` / `--color-success*` / `--color-warning*` / `--color-info*` sets, plus `--radius-card`, `--shadow-soft`. Monospace text uses Tailwind's `font-mono`, which `@theme inline` already maps to `--font-app-mono`.
- **Both themes must work.** Every colour comes from a token that is redefined under `:root.dark`, so never assume a light background.
- **Sample data is Calumpit-localized.** Barangay and team names refer to Calumpit, Bulacan — never Marikina.
- **Class composition uses `cn`** from `@/lib/utils`.
- **`lib/rescue-request-data.ts` and `lib/rescue-request-form.ts` must not import React or `lucide-react`** — they are imported by `node:test` unit tests. Icons are mapped to tag ids inside the component layer.
- **Components that use hooks or browser APIs start with `"use client";`.**
- **API field limits (enforced by `lib/report-api.ts`):** title ≤ 120 chars, description ≤ 1000 chars, location name ≤ 160 chars. Category must be `"Rescue Needed"`; severity must be `"Critical"`.
- **Verification commands:** `npm run lint`, `npm run typecheck`, `npm test`. The Playwright suite is `npx playwright test`.
- **Commit after every task.** End each commit message with:
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  ```

## File Structure

| File | Responsibility |
| --- | --- |
| `lib/rescue-request-data.ts` | **Create.** Types, assistance-tag definitions, timeline stage names, Calumpit sample requests, wait-tips, hotline rows, disclaimer copy. No React, no icons. |
| `lib/rescue-request-form.ts` | **Create.** Pure form logic: people-count clamping and labelling, assistance-tag toggling, description assembly, validation. Plus the `RescueRequestSubmission` type shared between form and page. No React. |
| `components/rescue-request-aside.tsx` | **Create.** Static "While you wait", "Emergency hotlines", and disclaimer cards. |
| `components/rescue-request-card.tsx` | **Create.** One request card plus its status timeline. Presentational. |
| `components/rescue-request-form.tsx` | **Create.** The form card: 911 strip, location controls, people stepper, assistance toggles, description, contact, photo, submit. Owns its own field state. |
| `components/rescue-request-content.tsx` | **Create.** Page layout and submit orchestration; owns the request list and network call. |
| `components/rescue-request-page.tsx` | **Delete.** Superseded standalone stub. |
| `app/rescue-request/page.tsx` | **Modify.** Render `<DashboardShell pageMode="rescue-request" />`. |
| `lib/constants.ts` | **Modify.** Add the `rescue-request` nav item. |
| `components/dashboard-shell.tsx` | **Modify.** Register the new `pageMode`. |
| `tests/rescue-request-form.test.ts` | **Create.** Unit tests for the pure form logic. |
| `tests/rescue-request-data.test.ts` | **Create.** Unit tests for sample-data invariants. |
| `tests/browser/rescue-request.spec.ts` | **Create.** Playwright coverage of the rendered page. |

**Note on the spec:** the spec listed a single `lib/rescue-request-data.ts`. This plan splits the pure *logic* into `lib/rescue-request-form.ts` so it can be unit-tested independently of the display data. This is a refinement, not a scope change.

---

### Task 1: Rescue request data module

**Files:**
- Create: `lib/rescue-request-data.ts`
- Test: `tests/rescue-request-data.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type RescueAssistanceTagId = "children" | "elderly" | "pwd" | "pregnant" | "medical" | "none"`
  - `type RescueAssistanceTag = { id: RescueAssistanceTagId; label: string; description: string }`
  - `const RESCUE_ASSISTANCE_TAGS: readonly RescueAssistanceTag[]`
  - `const RESCUE_NO_ASSISTANCE_TAG_ID: RescueAssistanceTagId`
  - `const RESCUE_TIMELINE_STAGES: readonly RescueTimelineStage[]` where `type RescueTimelineStage = "Request Received" | "Team Dispatched" | "Team En Route" | "Team On Scene" | "Rescue Complete"`
  - `type RescueTimelineEntry = { stage: RescueTimelineStage; time: string | null; detail: string | null }`
  - `type RescueRequestRecord = { id: string; statusLabel: string; complete: boolean; locationName: string; peopleCount: number; submittedLabel: string; assignedTeam: string | null; assistanceTagIds: RescueAssistanceTagId[]; description: string; timeline: RescueTimelineEntry[] }`
  - `const SAMPLE_RESCUE_REQUESTS: RescueRequestRecord[]`
  - `const RESCUE_WAIT_TIPS: readonly string[]`
  - `type RescueHotlineRow = { id: string; label: string; number: string; href: string }`
  - `const RESCUE_HOTLINES: readonly RescueHotlineRow[]`
  - `const RESCUE_HOTLINE_NOTICE: string`
  - `const RESCUE_DISCLAIMER: string`
  - `function buildPendingTimeline(receivedTime: string): RescueTimelineEntry[]`

- [x] **Step 1: Write the failing test**

Create `tests/rescue-request-data.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  RESCUE_ASSISTANCE_TAGS,
  RESCUE_HOTLINES,
  RESCUE_NO_ASSISTANCE_TAG_ID,
  RESCUE_TIMELINE_STAGES,
  RESCUE_WAIT_TIPS,
  SAMPLE_RESCUE_REQUESTS,
  buildPendingTimeline,
} from "@/lib/rescue-request-data";

test("assistance tags are unique and include the opt-out tag", () => {
  const ids = RESCUE_ASSISTANCE_TAGS.map((tag) => tag.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.includes(RESCUE_NO_ASSISTANCE_TAG_ID));
  assert.equal(RESCUE_ASSISTANCE_TAGS.length, 6);
});

test("every assistance tag carries display copy", () => {
  for (const tag of RESCUE_ASSISTANCE_TAGS) {
    assert.ok(tag.label.trim().length > 0, `${tag.id} has no label`);
    assert.ok(tag.description.trim().length > 0, `${tag.id} has no description`);
  }
});

test("sample requests reference Calumpit, never the reference mock's Marikina", () => {
  assert.ok(SAMPLE_RESCUE_REQUESTS.length > 0);

  for (const request of SAMPLE_RESCUE_REQUESTS) {
    const haystack = `${request.locationName} ${request.assignedTeam ?? ""} ${request.description}`;
    assert.ok(
      /calumpit/i.test(request.locationName),
      `${request.id} is not located in Calumpit`,
    );
    assert.ok(!/marikina/i.test(haystack), `${request.id} still mentions Marikina`);
  }
});

test("sample request timelines cover every stage in order", () => {
  for (const request of SAMPLE_RESCUE_REQUESTS) {
    assert.deepEqual(
      request.timeline.map((entry) => entry.stage),
      [...RESCUE_TIMELINE_STAGES],
      `${request.id} has an unexpected timeline`,
    );
  }
});

test("sample request timelines never resume after a pending stage", () => {
  for (const request of SAMPLE_RESCUE_REQUESTS) {
    const firstPendingIndex = request.timeline.findIndex((entry) => entry.time === null);

    if (firstPendingIndex === -1) {
      continue;
    }

    const tail = request.timeline.slice(firstPendingIndex);
    assert.ok(
      tail.every((entry) => entry.time === null),
      `${request.id} has a completed stage after a pending one`,
    );
  }
});

test("sample assistance tag ids all resolve to a defined tag", () => {
  const known = new Set(RESCUE_ASSISTANCE_TAGS.map((tag) => tag.id));

  for (const request of SAMPLE_RESCUE_REQUESTS) {
    for (const tagId of request.assistanceTagIds) {
      assert.ok(known.has(tagId), `${request.id} references unknown tag ${tagId}`);
    }
  }
});

test("a freshly submitted request only has its first stage filled in", () => {
  const timeline = buildPendingTimeline("4:10 PM");

  assert.deepEqual(
    timeline.map((entry) => entry.stage),
    [...RESCUE_TIMELINE_STAGES],
  );
  assert.equal(timeline[0].time, "4:10 PM");
  assert.ok(timeline.slice(1).every((entry) => entry.time === null));
  assert.ok(timeline.slice(1).every((entry) => entry.detail === null));
});

test("hotline rows expose a dialable href", () => {
  assert.ok(RESCUE_HOTLINES.length >= 3);

  for (const hotline of RESCUE_HOTLINES) {
    assert.ok(hotline.href.startsWith("tel:"), `${hotline.id} is not dialable`);
    assert.ok(hotline.label.trim().length > 0);
    assert.ok(hotline.number.trim().length > 0);
  }
});

test("wait tips are non-empty guidance strings", () => {
  assert.equal(RESCUE_WAIT_TIPS.length, 4);
  assert.ok(RESCUE_WAIT_TIPS.every((tip) => tip.trim().length > 0));
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npx tsx --test tests/rescue-request-data.test.ts`

Expected: FAIL — the module does not exist, so the import throws `Cannot find module '@/lib/rescue-request-data'`.

- [x] **Step 3: Write the implementation**

Create `lib/rescue-request-data.ts`:

```ts
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
  "This is a community-assist tool. Requests are prioritized by responders based on severity and available units. Always follow official advisories from PAGASA, NDRRMC, and your LGU.";
```

- [x] **Step 4: Run the test to verify it passes**

Run: `npx tsx --test tests/rescue-request-data.test.ts`

Expected: PASS — 8 tests pass, 0 fail.

- [x] **Step 5: Commit**

```bash
git add lib/rescue-request-data.ts tests/rescue-request-data.test.ts
git commit -m "feat: add rescue request display data module

Types, assistance tag definitions, timeline stages, and Calumpit-scoped
sample requests for the Request Rescue view. Kept free of React so the
node:test suite can import it directly.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Rescue request form logic

**Files:**
- Create: `lib/rescue-request-form.ts`
- Test: `tests/rescue-request-form.test.ts`

**Interfaces:**
- Consumes: `RescueAssistanceTagId`, `RESCUE_ASSISTANCE_TAGS`, `RESCUE_NO_ASSISTANCE_TAG_ID` from `@/lib/rescue-request-data`; `isWithinCalumpit`, `OUTSIDE_CALUMPIT_ERROR_MESSAGE` from `@/lib/calumpit-boundary`; `ReportLocationSource` from `@/lib/report-location-metadata`.
- Produces:
  - `const RESCUE_MIN_PEOPLE = 1`, `RESCUE_MAX_PEOPLE = 50`
  - `const RESCUE_MIN_SITUATION_LENGTH = 10`, `RESCUE_MAX_SITUATION_LENGTH = 700`
  - `const RESCUE_REPORT_TITLE`, `RESCUE_REPORT_CATEGORY`, `RESCUE_REPORT_SEVERITY`
  - `function clampRescuePeopleCount(value: number): number`
  - `function formatRescuePeopleLabel(count: number): string`
  - `function toggleRescueAssistanceTag(selected: RescueAssistanceTagId[], tagId: RescueAssistanceTagId): RescueAssistanceTagId[]`
  - `function describeRescueAssistanceTags(ids: RescueAssistanceTagId[]): string`
  - `function buildRescueRequestDescription(input: RescueDescriptionInput): string`
  - `function validateRescueRequestForm(input: RescueValidationInput): string | null`
  - `type RescueRequestSubmission`

- [x] **Step 1: Write the failing test**

Create `tests/rescue-request-form.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { OUTSIDE_CALUMPIT_ERROR_MESSAGE } from "@/lib/calumpit-boundary";
import {
  RESCUE_MAX_PEOPLE,
  RESCUE_MIN_PEOPLE,
  buildRescueRequestDescription,
  clampRescuePeopleCount,
  describeRescueAssistanceTags,
  formatRescuePeopleLabel,
  toggleRescueAssistanceTag,
  validateRescueRequestForm,
} from "@/lib/rescue-request-form";

// Poblacion, Calumpit - well inside the municipal polygon.
const CALUMPIT = { latitude: "14.916", longitude: "120.766" };
// Malolos City - outside Calumpit, same as the picker specs use.
const MALOLOS = { latitude: "14.8515", longitude: "120.8162" };

const VALID_INPUT = {
  locationName: "Brgy. Meysulao, Calumpit",
  latitude: CALUMPIT.latitude,
  longitude: CALUMPIT.longitude,
  situation: "Water is chest deep and still rising on our street.",
};

test("people count is clamped to the supported range", () => {
  assert.equal(clampRescuePeopleCount(4), 4);
  assert.equal(clampRescuePeopleCount(0), RESCUE_MIN_PEOPLE);
  assert.equal(clampRescuePeopleCount(-12), RESCUE_MIN_PEOPLE);
  assert.equal(clampRescuePeopleCount(999), RESCUE_MAX_PEOPLE);
  // A blank or non-numeric stepper input must not produce NaN in the payload.
  assert.equal(clampRescuePeopleCount(Number.NaN), RESCUE_MIN_PEOPLE);
  assert.equal(clampRescuePeopleCount(3.7), 3);
});

test("people label is singular only for one person", () => {
  assert.equal(formatRescuePeopleLabel(1), "1 person");
  assert.equal(formatRescuePeopleLabel(2), "2 people");
  assert.equal(formatRescuePeopleLabel(12), "12 people");
});

test("assistance tags toggle on and off", () => {
  assert.deepEqual(toggleRescueAssistanceTag([], "children"), ["children"]);
  assert.deepEqual(
    toggleRescueAssistanceTag(["children"], "elderly"),
    ["children", "elderly"],
  );
  assert.deepEqual(toggleRescueAssistanceTag(["children", "elderly"], "children"), [
    "elderly",
  ]);
});

test("selecting None clears every other assistance tag", () => {
  assert.deepEqual(toggleRescueAssistanceTag(["children", "medical"], "none"), [
    "none",
  ]);
});

test("selecting a real need clears None", () => {
  assert.deepEqual(toggleRescueAssistanceTag(["none"], "pregnant"), ["pregnant"]);
});

test("None can be switched off like any other tag", () => {
  assert.deepEqual(toggleRescueAssistanceTag(["none"], "none"), []);
});

test("assistance tags are described in their defined order", () => {
  assert.equal(
    describeRescueAssistanceTags(["elderly", "children"]),
    "Children, Elderly",
  );
  assert.equal(describeRescueAssistanceTags([]), "");
  assert.equal(describeRescueAssistanceTags(["none"]), "None");
});

test("description carries the situation, headcount, needs, and contact", () => {
  const description = buildRescueRequestDescription({
    situation: "  Water is chest deep on the ground floor.  ",
    peopleCount: 4,
    assistanceTagIds: ["children", "elderly"],
    contactNumber: " 0917 000 0000 ",
  });

  assert.ok(description.startsWith("RESCUE REQUEST"));
  assert.ok(description.includes("Water is chest deep on the ground floor."));
  assert.ok(description.includes("People needing assistance: 4"));
  assert.ok(description.includes("Special assistance: Children, Elderly"));
  assert.ok(description.includes("Contact number: 0917 000 0000"));
});

test("description omits optional lines that were left blank", () => {
  const description = buildRescueRequestDescription({
    situation: "Roof access only, water still rising.",
    peopleCount: 1,
    assistanceTagIds: [],
    contactNumber: "",
  });

  assert.ok(!description.includes("Special assistance:"));
  assert.ok(!description.includes("Contact number:"));
  assert.ok(description.includes("People needing assistance: 1"));
});

test("description stays inside the report API's 1000 character limit", () => {
  const description = buildRescueRequestDescription({
    situation: "x".repeat(700),
    peopleCount: RESCUE_MAX_PEOPLE,
    assistanceTagIds: [
      "children",
      "elderly",
      "pwd",
      "pregnant",
      "medical",
    ],
    contactNumber: "0917 000 0000",
  });

  assert.ok(
    description.length <= 1000,
    `description was ${description.length} characters`,
  );
});

test("a fully filled Calumpit form validates", () => {
  assert.equal(validateRescueRequestForm(VALID_INPUT), null);
});

test("a missing location is rejected", () => {
  const error = validateRescueRequestForm({ ...VALID_INPUT, locationName: "   " });
  assert.equal(error, "Add the location where help is needed.");
});

test("an unpinned location is rejected", () => {
  const error = validateRescueRequestForm({
    ...VALID_INPUT,
    latitude: "",
    longitude: "",
  });
  assert.equal(
    error,
    "Pin your location with your current location or the map so responders can reach you.",
  );
});

test("coordinates outside Calumpit are rejected with the shared message", () => {
  const error = validateRescueRequestForm({
    ...VALID_INPUT,
    latitude: MALOLOS.latitude,
    longitude: MALOLOS.longitude,
  });
  assert.equal(error, OUTSIDE_CALUMPIT_ERROR_MESSAGE);
});

test("a too-short situation is rejected", () => {
  const error = validateRescueRequestForm({ ...VALID_INPUT, situation: "help" });
  assert.equal(
    error,
    "Describe your situation in at least 10 characters so responders know what to prepare.",
  );
});

test("an over-long location name is rejected before the API sees it", () => {
  const error = validateRescueRequestForm({
    ...VALID_INPUT,
    locationName: "a".repeat(161),
  });
  assert.equal(error, "Location must not exceed 160 characters.");
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npx tsx --test tests/rescue-request-form.test.ts`

Expected: FAIL — `Cannot find module '@/lib/rescue-request-form'`.

- [x] **Step 3: Write the implementation**

Create `lib/rescue-request-form.ts`:

```ts
import {
  OUTSIDE_CALUMPIT_ERROR_MESSAGE,
  isWithinCalumpit,
} from "@/lib/calumpit-boundary";
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

/** A rescue request is filed through the shared flood-report endpoint. */
export const RESCUE_REPORT_TITLE = "Rescue assistance requested";
export const RESCUE_REPORT_CATEGORY = "Rescue Needed";
export const RESCUE_REPORT_SEVERITY = "Critical";

export type RescueRequestSubmission = {
  locationName: string;
  latitude: string;
  longitude: string;
  locationSource: ReportLocationSource;
  gpsAccuracyMeters: number | null;
  peopleCount: number;
  assistanceTagIds: RescueAssistanceTagId[];
  situation: string;
  contactNumber: string;
  photo: File | null;
  photoCapturedAt: Date | null;
};

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
};

/** Returns the first blocking problem, or null when the form can be sent. */
export function validateRescueRequestForm({
  locationName,
  latitude,
  longitude,
  situation,
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
    latitude.trim() === "" ||
    longitude.trim() === "" ||
    !Number.isFinite(parsedLatitude) ||
    !Number.isFinite(parsedLongitude)
  ) {
    return "Pin your location with your current location or the map so responders can reach you.";
  }

  // Same rule the server enforces, checked here so the user is not told to
  // wait on a request that was never going to be accepted.
  if (!isWithinCalumpit(parsedLatitude, parsedLongitude)) {
    return OUTSIDE_CALUMPIT_ERROR_MESSAGE;
  }

  if (situation.trim().length < RESCUE_MIN_SITUATION_LENGTH) {
    return `Describe your situation in at least ${RESCUE_MIN_SITUATION_LENGTH} characters so responders know what to prepare.`;
  }

  return null;
}
```

- [x] **Step 4: Run the test to verify it passes**

Run: `npx tsx --test tests/rescue-request-form.test.ts`

Expected: PASS — 15 tests pass, 0 fail.

- [x] **Step 5: Run the whole unit suite to confirm nothing regressed**

Run: `npm test`

Expected: all existing suites still pass, plus the two new files.

- [x] **Step 6: Commit**

```bash
git add lib/rescue-request-form.ts tests/rescue-request-form.test.ts
git commit -m "feat: add rescue request form logic

Pure helpers for people-count clamping, mutually exclusive assistance
tags, report description assembly, and client-side validation including
the Calumpit boundary check the report API also enforces.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

> **Deviation from plan (approved during execution):** `validateRescueRequestForm` also rejects a situation longer than `RESCUE_MAX_SITUATION_LENGTH`, so the 1000-character description guarantee does not rest on the textarea `maxLength` attribute alone. Covered by two boundary tests.

---

### Task 3: Aside cards

**Files:**
- Create: `components/rescue-request-aside.tsx`

**Interfaces:**
- Consumes: `RESCUE_DISCLAIMER`, `RESCUE_HOTLINES`, `RESCUE_HOTLINE_NOTICE`, `RESCUE_WAIT_TIPS` from `@/lib/rescue-request-data` (Task 1).
- Produces: `function RescueRequestAside(): JSX.Element` — takes no props.

- [x] **Step 1: Write the component**

Create `components/rescue-request-aside.tsx`:

```tsx
import { Phone, ShieldCheck, Waves } from "lucide-react";

import {
  RESCUE_DISCLAIMER,
  RESCUE_HOTLINES,
  RESCUE_HOTLINE_NOTICE,
  RESCUE_WAIT_TIPS,
} from "@/lib/rescue-request-data";

/**
 * Static support column for the Request Rescue view: what to do while waiting,
 * who to call, and what this tool is not. Rendered beside the form on large
 * screens and stacked underneath the request list on small ones.
 */
export function RescueRequestAside() {
  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[var(--radius-card)] border border-[color:color-mix(in_srgb,var(--color-border)_78%,transparent)] bg-[color:color-mix(in_srgb,var(--color-surface)_94%,transparent)] p-4 shadow-[var(--shadow-soft)]">
        <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold text-[var(--color-foreground)]">
          <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--color-success)]" />
          <span>While you wait</span>
        </h2>

        <ul className="mt-3 flex flex-col gap-3">
          {RESCUE_WAIT_TIPS.map((tip) => (
            <li key={tip} className="flex items-start gap-2.5">
              <Waves className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-primary)]" />
              <span className="text-[0.86rem] leading-6 text-[var(--color-foreground)]">
                {tip}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-[var(--radius-card)] border border-[var(--color-danger-border)] bg-[color:color-mix(in_srgb,var(--color-danger)_6%,var(--color-surface))] p-4 shadow-[var(--shadow-soft)]">
        <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold text-[var(--color-danger)]">
          <Phone className="h-4 w-4 shrink-0" />
          <span>Emergency hotlines</span>
        </h2>

        <ul className="mt-3 flex flex-col gap-2">
          {RESCUE_HOTLINES.map((hotline) => (
            <li key={hotline.id}>
              <a
                href={hotline.href}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-control)] border border-[color:color-mix(in_srgb,var(--color-border)_70%,transparent)] bg-[color:color-mix(in_srgb,var(--color-panel)_74%,transparent)] px-3 py-2.5 transition hover:border-[var(--color-danger-border)]"
              >
                <span className="text-[0.84rem] text-[var(--color-foreground)]">
                  {hotline.label}
                </span>
                <span className="text-[0.86rem] font-semibold tabular-nums text-[var(--color-foreground)]">
                  {hotline.number}
                </span>
              </a>
            </li>
          ))}
        </ul>

        <p className="mt-3 text-[0.78rem] leading-5 text-[var(--color-danger)]">
          {RESCUE_HOTLINE_NOTICE}
        </p>
      </section>

      <section className="rounded-[var(--radius-card)] border border-[color:color-mix(in_srgb,var(--color-border)_78%,transparent)] bg-[color:color-mix(in_srgb,var(--color-surface)_94%,transparent)] p-4">
        <p className="text-[0.78rem] leading-5 text-[var(--color-muted-foreground)]">
          {RESCUE_DISCLAIMER}
        </p>
      </section>
    </div>
  );
}
```

- [x] **Step 2: Verify it typechecks and lints**

Run: `npm run typecheck && npm run lint`

Expected: both exit 0 with no errors for `components/rescue-request-aside.tsx`.

- [x] **Step 3: Commit**

```bash
git add components/rescue-request-aside.tsx
git commit -m "feat: add rescue request aside cards

Wait guidance, emergency hotlines, and the community-assist disclaimer
shown alongside the Request Rescue form.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Request card with status timeline

**Files:**
- Create: `components/rescue-request-card.tsx`

**Interfaces:**
- Consumes: `RESCUE_ASSISTANCE_TAGS`, `RescueRequestRecord` from `@/lib/rescue-request-data` (Task 1); `formatRescuePeopleLabel` from `@/lib/rescue-request-form` (Task 2); `cn` from `@/lib/utils`.
- Produces: `function RescueRequestCard({ request }: { request: RescueRequestRecord }): JSX.Element`

- [x] **Step 1: Write the component**

Create `components/rescue-request-card.tsx`:

```tsx
import { Check, Clock, MapPin, Radio, Users } from "lucide-react";

import {
  RESCUE_ASSISTANCE_TAGS,
  type RescueRequestRecord,
} from "@/lib/rescue-request-data";
import { formatRescuePeopleLabel } from "@/lib/rescue-request-form";
import { cn } from "@/lib/utils";

type RescueRequestCardProps = {
  request: RescueRequestRecord;
};

function describeTagLabels(request: RescueRequestRecord) {
  return RESCUE_ASSISTANCE_TAGS.filter((tag) =>
    request.assistanceTagIds.includes(tag.id),
  );
}

/**
 * One filed request: who and where, followed by the five-stage timeline.
 *
 * The last stamped stage is the current one; everything after it is pending.
 * That is derived here rather than stored, so a record can never disagree with
 * itself about which stage it is on.
 */
export function RescueRequestCard({ request }: RescueRequestCardProps) {
  const lastCompletedIndex = request.timeline.reduce(
    (latest, entry, index) => (entry.time ? index : latest),
    -1,
  );
  const tags = describeTagLabels(request);

  return (
    <article className="rounded-[var(--radius-card)] border border-[color:color-mix(in_srgb,var(--color-border)_78%,transparent)] bg-[color:color-mix(in_srgb,var(--color-surface)_94%,transparent)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="font-mono text-[0.78rem] font-semibold tracking-[0.04em] text-[var(--color-muted-foreground)]">
          {request.id}
        </p>

        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[0.72rem] font-semibold",
            request.complete
              ? "bg-[var(--color-success-surface)] text-[var(--color-success-text)]"
              : "bg-[var(--color-primary)] text-white",
          )}
        >
          {request.statusLabel}
        </span>
      </div>

      <h3 className="mt-2 flex items-start gap-2 text-[0.95rem] font-semibold text-[var(--color-foreground)]">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-muted-foreground)]" />
        <span className="min-w-0">{request.locationName}</span>
      </h3>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.78rem] text-[var(--color-muted-foreground)]">
        <span className="inline-flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 shrink-0" />
          {formatRescuePeopleLabel(request.peopleCount)}
        </span>

        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          {request.submittedLabel}
        </span>

        {request.assignedTeam ? (
          <span className="inline-flex items-center gap-1.5">
            <Radio className="h-3.5 w-3.5 shrink-0" />
            {request.assignedTeam}
          </span>
        ) : null}
      </div>

      {tags.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <li
              key={tag.id}
              className="rounded-full border border-[color:color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[color:color-mix(in_srgb,var(--color-panel)_78%,transparent)] px-2.5 py-1 text-[0.72rem] font-medium text-[var(--color-foreground)]"
            >
              {tag.label}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-3 text-[0.86rem] leading-6 text-[var(--color-muted-foreground)]">
        {request.description}
      </p>

      <section className="mt-4 rounded-[var(--radius-panel)] border border-[color:color-mix(in_srgb,var(--color-border)_70%,transparent)] bg-[color:color-mix(in_srgb,var(--color-panel)_60%,transparent)] p-3.5 sm:p-4">
        <h4 className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-muted-foreground)]">
          Status timeline
        </h4>

        <ol className="mt-3">
          {request.timeline.map((entry, index) => {
            const done = entry.time !== null;
            const current = index === lastCompletedIndex;
            const isLast = index === request.timeline.length - 1;

            return (
              <li key={entry.stage} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                      current
                        ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                        : done
                          ? "border-[var(--color-warning)] bg-[var(--color-warning)] text-white"
                          : "border-[color:color-mix(in_srgb,var(--color-muted-foreground)_46%,transparent)] bg-[var(--color-surface)] text-[var(--color-muted-foreground)]",
                    )}
                  >
                    {done ? (
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    )}
                  </span>

                  {isLast ? null : (
                    <span
                      className={cn(
                        "w-px flex-1",
                        done
                          ? "bg-[var(--color-warning)]"
                          : "bg-[color:color-mix(in_srgb,var(--color-muted-foreground)_32%,transparent)]",
                      )}
                    />
                  )}
                </div>

                <div className={cn("min-w-0", isLast ? "pb-0" : "pb-4")}>
                  <p
                    className={cn(
                      "text-[0.86rem] font-semibold",
                      done
                        ? "text-[var(--color-foreground)]"
                        : "text-[var(--color-muted-foreground)]",
                    )}
                  >
                    {entry.stage}
                  </p>

                  <p className="mt-0.5 text-[0.78rem] leading-5 text-[var(--color-muted-foreground)]">
                    {entry.time ? (
                      <>
                        {entry.time}
                        {entry.detail ? ` — ${entry.detail}` : null}
                      </>
                    ) : (
                      "Pending"
                    )}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </article>
  );
}
```

- [x] **Step 2: Verify it typechecks and lints**

Run: `npm run typecheck && npm run lint`

Expected: both exit 0.

- [x] **Step 3: Commit**

```bash
git add components/rescue-request-card.tsx
git commit -m "feat: add rescue request card with status timeline

Renders a filed request and derives the current stage from the last
stamped timeline entry so the record cannot contradict itself.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Rescue request form card

**Files:**
- Create: `components/rescue-request-form.tsx`

**Interfaces:**
- Consumes: everything produced by Tasks 1 and 2; `IncidentLocationPicker` from `@/components/incident-location-picker`; `ReportCameraCapture` from `@/components/report-camera-capture`; `resolveReportLocationName` from `@/lib/report-location-client`; `buildCoordinateFallbackLabel` from `@/lib/geo-format`; `isWithinCalumpit` from `@/lib/calumpit-boundary`; `getReportImageAcceptValue`, `validateReportImageFile` from `@/lib/report-image-validation`; `cn` from `@/lib/utils`.
- Produces:
  ```ts
  type RescueRequestFormProps = {
    signedIn: boolean;
    authLoading: boolean;
    onSubmit: (submission: RescueRequestSubmission) => Promise<boolean>;
  };
  function RescueRequestForm(props: RescueRequestFormProps): JSX.Element
  ```
  `onSubmit` resolves `true` when the request was accepted; the form clears itself only then.

**Notes for the implementer:**
- `IncidentLocationPicker` is a modal. Render it only while open, mirroring `components/incident-reports-content.tsx:2343`.
- `ReportCameraCapture`'s `onUploadInstead` prop is the escape hatch when the camera fails — close the modal and open the file input.
- `data-testid` attributes are required by the Playwright spec in Task 8. Do not rename them.

- [x] **Step 1: Write the component**

Create `components/rescue-request-form.tsx`:

```tsx
"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  Accessibility,
  Baby,
  Camera,
  CircleSlash,
  CloudUpload,
  HeartPulse,
  LifeBuoy,
  LoaderCircle,
  Map as MapIcon,
  Minus,
  PersonStanding,
  Phone,
  Plus,
  Smartphone,
  Stethoscope,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";

import { IncidentLocationPicker } from "@/components/incident-location-picker";
import { ReportCameraCapture } from "@/components/report-camera-capture";
import { isWithinCalumpit } from "@/lib/calumpit-boundary";
import { buildCoordinateFallbackLabel } from "@/lib/geo-format";
import {
  getReportImageAcceptValue,
  validateReportImageFile,
} from "@/lib/report-image-validation";
import { resolveReportLocationName } from "@/lib/report-location-client";
import type { ReportLocationSource } from "@/lib/report-location-metadata";
import {
  RESCUE_ASSISTANCE_TAGS,
  type RescueAssistanceTagId,
} from "@/lib/rescue-request-data";
import {
  RESCUE_MAX_CONTACT_LENGTH,
  RESCUE_MAX_LOCATION_NAME_LENGTH,
  RESCUE_MAX_SITUATION_LENGTH,
  clampRescuePeopleCount,
  formatRescuePeopleLabel,
  toggleRescueAssistanceTag,
  validateRescueRequestForm,
  type RescueRequestSubmission,
} from "@/lib/rescue-request-form";
import { cn } from "@/lib/utils";

const ASSISTANCE_TAG_ICONS: Record<RescueAssistanceTagId, LucideIcon> = {
  children: Baby,
  elderly: PersonStanding,
  pwd: Accessibility,
  pregnant: HeartPulse,
  medical: Stethoscope,
  none: CircleSlash,
};

type RescueRequestFormProps = {
  signedIn: boolean;
  authLoading: boolean;
  onSubmit: (submission: RescueRequestSubmission) => Promise<boolean>;
};

const EMPTY_FIELDS = {
  locationName: "",
  latitude: "",
  longitude: "",
  situation: "",
  contactNumber: "",
};

export function RescueRequestForm({
  signedIn,
  authLoading,
  onSubmit,
}: RescueRequestFormProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [fields, setFields] = useState(EMPTY_FIELDS);
  const [locationSource, setLocationSource] =
    useState<ReportLocationSource>("manual");
  const [gpsAccuracyMeters, setGpsAccuracyMeters] = useState<number | null>(null);
  const [peopleCount, setPeopleCount] = useState(1);
  const [assistanceTagIds, setAssistanceTagIds] = useState<RescueAssistanceTagId[]>(
    [],
  );
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoCapturedAt, setPhotoCapturedAt] = useState<Date | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);

  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [locatingUser, setLocatingUser] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const submitDisabled = submitting || locatingUser || !signedIn;

  function updateField(key: keyof typeof EMPTY_FIELDS, value: string) {
    setErrorMessage(null);
    setFields((current) => ({ ...current, [key]: value }));
  }

  function attachPhoto(file: File, capturedAt: Date | null) {
    const validationError = validateReportImageFile({
      name: file.name,
      type: file.type,
      size: file.size,
    });

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    // Revoke the previous object URL before replacing it, or the browser holds
    // the discarded blob for the lifetime of the page.
    setPhotoPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }

      return URL.createObjectURL(file);
    });
    setPhoto(file);
    setPhotoCapturedAt(capturedAt);
    setErrorMessage(null);
  }

  function clearPhoto() {
    setPhotoPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }

      return null;
    });
    setPhoto(null);
    setPhotoCapturedAt(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function resetForm() {
    setFields(EMPTY_FIELDS);
    setLocationSource("manual");
    setGpsAccuracyMeters(null);
    setPeopleCount(1);
    setAssistanceTagIds([]);
    clearPhoto();
  }

  function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      setErrorMessage("This browser does not support location sharing.");
      return;
    }

    setErrorMessage(null);
    setLocatingUser(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { accuracy, latitude, longitude } = position.coords;

        // Same rule as the server: no tolerance buffer, because a borderline
        // point accepted here would only be rejected on submit.
        if (!isWithinCalumpit(latitude, longitude)) {
          setLocatingUser(false);
          setErrorMessage(
            "Your current location appears to be outside Calumpit, Bulacan. If you are near the boundary, pick the exact spot on the map instead.",
          );
          setLocationPickerOpen(true);
          return;
        }

        setLocationSource("gps");
        setGpsAccuracyMeters(Number.isFinite(accuracy) ? accuracy : null);
        setFields((current) => ({
          ...current,
          latitude: String(latitude),
          longitude: String(longitude),
        }));

        try {
          const { locationName } = await resolveReportLocationName(
            latitude,
            longitude,
          );
          setFields((current) => ({ ...current, locationName }));
        } catch {
          setFields((current) => ({
            ...current,
            locationName: buildCoordinateFallbackLabel(
              latitude,
              longitude,
              "Pinned location near",
            ),
          }));
        } finally {
          setLocatingUser(false);
        }
      },
      () => {
        setLocatingUser(false);
        setErrorMessage(
          "Location sharing was blocked. Choose your spot on the map instead.",
        );
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    const validationError = validateRescueRequestForm({
      locationName: fields.locationName,
      latitude: fields.latitude,
      longitude: fields.longitude,
      situation: fields.situation,
    });

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setErrorMessage(null);
    setSubmitting(true);

    try {
      const accepted = await onSubmit({
        locationName: fields.locationName.trim(),
        latitude: fields.latitude,
        longitude: fields.longitude,
        locationSource,
        gpsAccuracyMeters,
        peopleCount,
        assistanceTagIds,
        situation: fields.situation,
        contactNumber: fields.contactNumber,
        photo,
        photoCapturedAt,
      });

      if (accepted) {
        resetForm();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        data-testid="rescue-request-form"
        className="rounded-[var(--radius-card)] border border-[color:color-mix(in_srgb,var(--color-border)_80%,transparent)] bg-[color:color-mix(in_srgb,var(--color-surface)_94%,transparent)] p-4 shadow-[var(--shadow-soft)] sm:p-6"
      >
        <p className="flex items-start gap-2.5 rounded-[var(--radius-panel)] border border-[var(--color-danger-border)] bg-[color:color-mix(in_srgb,var(--color-danger)_6%,var(--color-surface))] p-3.5 text-[0.86rem] leading-6 text-[var(--color-foreground)]">
          <Phone className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-danger)]" />
          <span>
            <strong className="font-semibold text-[var(--color-danger)]">
              If life is in immediate danger, call 911 now.
            </strong>{" "}
            Use this form when it is safe to wait for a coordinated rescue team.
          </span>
        </p>

        <section className="mt-5">
          <h2 className="text-[0.95rem] font-semibold text-[var(--color-foreground)]">
            Where do you need help?
          </h2>
          <p className="mt-0.5 text-[0.8rem] text-[var(--color-muted-foreground)]">
            Pin your exact location so responders can reach you quickly.
          </p>

          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={locatingUser}
              data-testid="rescue-use-current-location"
              className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[color:color-mix(in_srgb,var(--color-border)_74%,transparent)] bg-[color:color-mix(in_srgb,var(--color-panel)_70%,transparent)] px-3 py-2.5 text-[0.84rem] font-medium text-[var(--color-foreground)] transition hover:border-[var(--color-primary)] disabled:opacity-60"
            >
              {locatingUser ? (
                <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-[var(--color-primary)]" />
              ) : (
                <Smartphone className="h-4 w-4 shrink-0 text-[var(--color-primary)]" />
              )}
              <span>
                {locatingUser ? "Getting your location..." : "Use My Current Location"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setLocationPickerOpen(true)}
              data-testid="rescue-choose-on-map"
              className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[color:color-mix(in_srgb,var(--color-border)_74%,transparent)] bg-[color:color-mix(in_srgb,var(--color-panel)_70%,transparent)] px-3 py-2.5 text-[0.84rem] font-medium text-[var(--color-foreground)] transition hover:border-[var(--color-primary)]"
            >
              <MapIcon className="h-4 w-4 shrink-0 text-[var(--color-primary)]" />
              <span>Choose on Map</span>
            </button>
          </div>

          <label className="mt-2.5 block">
            <span className="sr-only">Location</span>
            <input
              value={fields.locationName}
              onChange={(event) => {
                setLocationSource("manual");
                updateField("locationName", event.target.value);
              }}
              maxLength={RESCUE_MAX_LOCATION_NAME_LENGTH}
              placeholder="Street, barangay, city or coordinates"
              data-testid="rescue-location-name"
              className="w-full rounded-[var(--radius-control)] border border-[color:color-mix(in_srgb,var(--color-border)_74%,transparent)] bg-[color:color-mix(in_srgb,var(--color-panel)_58%,transparent)] px-3 py-2.5 text-[0.86rem] text-[var(--color-foreground)] outline-none transition placeholder:text-[var(--color-muted-foreground)] focus:border-[var(--color-primary)]"
            />
          </label>
        </section>

        <hr className="my-5 border-[color:color-mix(in_srgb,var(--color-border)_70%,transparent)]" />

        <section>
          <h2 className="text-[0.95rem] font-semibold text-[var(--color-foreground)]">
            People needing assistance
          </h2>
          <p className="mt-0.5 text-[0.8rem] text-[var(--color-muted-foreground)]">
            Include yourself in the total count.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center rounded-[var(--radius-control)] border border-[color:color-mix(in_srgb,var(--color-border)_74%,transparent)] bg-[color:color-mix(in_srgb,var(--color-panel)_58%,transparent)]">
              <button
                type="button"
                aria-label="Decrease people needing assistance"
                data-testid="rescue-people-decrement"
                onClick={() =>
                  setPeopleCount((current) => clampRescuePeopleCount(current - 1))
                }
                className="flex h-11 w-11 items-center justify-center rounded-l-[var(--radius-control)] text-[var(--color-muted-foreground)] transition hover:text-[var(--color-foreground)]"
              >
                <Minus className="h-4 w-4" />
              </button>

              <span
                data-testid="rescue-people-count"
                aria-live="polite"
                className="min-w-11 text-center text-[0.95rem] font-semibold tabular-nums text-[var(--color-foreground)]"
              >
                {peopleCount}
              </span>

              <button
                type="button"
                aria-label="Increase people needing assistance"
                data-testid="rescue-people-increment"
                onClick={() =>
                  setPeopleCount((current) => clampRescuePeopleCount(current + 1))
                }
                className="flex h-11 w-11 items-center justify-center rounded-r-[var(--radius-control)] text-[var(--color-muted-foreground)] transition hover:text-[var(--color-foreground)]"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <span className="text-[0.84rem] text-[var(--color-muted-foreground)]">
              {formatRescuePeopleLabel(peopleCount)}
            </span>
          </div>
        </section>

        <hr className="my-5 border-[color:color-mix(in_srgb,var(--color-border)_70%,transparent)]" />

        <section>
          <h2 className="text-[0.95rem] font-semibold text-[var(--color-foreground)]">
            Special assistance needed
          </h2>
          <p className="mt-0.5 text-[0.8rem] text-[var(--color-muted-foreground)]">
            Select all that apply so responders can prepare.
          </p>

          <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {RESCUE_ASSISTANCE_TAGS.map((tag) => {
              const Icon = ASSISTANCE_TAG_ICONS[tag.id];
              const selected = assistanceTagIds.includes(tag.id);

              return (
                <button
                  key={tag.id}
                  type="button"
                  aria-pressed={selected}
                  data-testid={`rescue-assistance-${tag.id}`}
                  onClick={() =>
                    setAssistanceTagIds((current) =>
                      toggleRescueAssistanceTag(current, tag.id),
                    )
                  }
                  className={cn(
                    "flex flex-col gap-1.5 rounded-[var(--radius-control)] border p-3 text-left transition",
                    selected
                      ? "border-[var(--color-primary)] bg-[var(--color-info-surface)]"
                      : "border-[color:color-mix(in_srgb,var(--color-border)_74%,transparent)] bg-[color:color-mix(in_srgb,var(--color-panel)_58%,transparent)] hover:border-[color:color-mix(in_srgb,var(--color-primary)_50%,transparent)]",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      selected
                        ? "text-[var(--color-primary)]"
                        : "text-[var(--color-muted-foreground)]",
                    )}
                  />
                  <span className="text-[0.86rem] font-semibold text-[var(--color-foreground)]">
                    {tag.label}
                  </span>
                  <span className="text-[0.74rem] leading-5 text-[var(--color-muted-foreground)]">
                    {tag.description}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <label className="mt-5 block">
          <span className="text-[0.95rem] font-semibold text-[var(--color-foreground)]">
            Describe your situation
          </span>
          <textarea
            value={fields.situation}
            onChange={(event) => updateField("situation", event.target.value)}
            rows={4}
            maxLength={RESCUE_MAX_SITUATION_LENGTH}
            placeholder="Water level, whether you can move to higher ground, urgent medical needs, landmarks near you..."
            data-testid="rescue-situation"
            className="mt-2 w-full resize-y rounded-[var(--radius-control)] border border-[color:color-mix(in_srgb,var(--color-border)_74%,transparent)] bg-[color:color-mix(in_srgb,var(--color-panel)_58%,transparent)] p-3 text-[0.86rem] leading-6 text-[var(--color-foreground)] outline-none transition placeholder:text-[var(--color-muted-foreground)] focus:border-[var(--color-primary)]"
          />
        </label>

        <label className="mt-4 block">
          <span className="text-[0.95rem] font-semibold text-[var(--color-foreground)]">
            Contact number
          </span>
          <span className="mt-2 flex items-center gap-2 rounded-[var(--radius-control)] border border-[color:color-mix(in_srgb,var(--color-border)_74%,transparent)] bg-[color:color-mix(in_srgb,var(--color-panel)_58%,transparent)] px-3 transition focus-within:border-[var(--color-primary)]">
            <Phone className="h-4 w-4 shrink-0 text-[var(--color-muted-foreground)]" />
            <input
              value={fields.contactNumber}
              onChange={(event) => updateField("contactNumber", event.target.value)}
              type="tel"
              inputMode="tel"
              maxLength={RESCUE_MAX_CONTACT_LENGTH}
              placeholder="09xx xxx xxxx"
              data-testid="rescue-contact"
              className="min-w-0 flex-1 bg-transparent py-2.5 text-[0.86rem] text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted-foreground)]"
            />
          </span>
        </label>

        <section className="mt-4">
          <h2 className="text-[0.95rem] font-semibold text-[var(--color-foreground)]">
            Add a photo (optional)
          </h2>

          <input
            ref={fileInputRef}
            type="file"
            accept={getReportImageAcceptValue()}
            className="hidden"
            data-testid="rescue-photo-input"
            onChange={(event) => {
              const file = event.target.files?.[0];

              if (file) {
                attachPhoto(file, null);
              }
            }}
          />

          {photo && photoPreviewUrl ? (
            <div className="mt-2 flex items-center gap-3 rounded-[var(--radius-control)] border border-[color:color-mix(in_srgb,var(--color-border)_74%,transparent)] bg-[color:color-mix(in_srgb,var(--color-panel)_58%,transparent)] p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoPreviewUrl}
                alt="Attached photo preview"
                className="h-16 w-16 shrink-0 rounded-[10px] object-cover"
              />
              <span className="min-w-0 flex-1 truncate text-[0.82rem] text-[var(--color-foreground)]">
                {photo.name}
              </span>
              <button
                type="button"
                onClick={clearPhoto}
                aria-label="Remove photo"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[color:color-mix(in_srgb,var(--color-border)_74%,transparent)] text-[var(--color-muted-foreground)] transition hover:text-[var(--color-danger)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="mt-2 flex flex-col items-center gap-2 rounded-[var(--radius-control)] border border-dashed border-[color:color-mix(in_srgb,var(--color-border)_82%,transparent)] bg-[color:color-mix(in_srgb,var(--color-panel)_44%,transparent)] px-4 py-6 text-center">
              <CloudUpload className="h-5 w-5 text-[var(--color-muted-foreground)]" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                data-testid="rescue-photo-upload"
                className="text-[0.86rem] font-semibold text-[var(--color-foreground)] underline-offset-4 hover:underline"
              >
                Tap to add a photo
              </button>
              <p className="text-[0.74rem] text-[var(--color-muted-foreground)]">
                Helps responders assess the scene
              </p>
              <button
                type="button"
                onClick={() => setCameraOpen(true)}
                className="mt-1 inline-flex items-center gap-1.5 text-[0.78rem] font-medium text-[var(--color-primary)]"
              >
                <Camera className="h-3.5 w-3.5" />
                <span>Take a photo instead</span>
              </button>
            </div>
          )}
        </section>

        {errorMessage ? (
          <p
            role="alert"
            data-testid="rescue-form-error"
            className="mt-4 flex items-start gap-2 rounded-[var(--radius-panel)] border border-[var(--color-danger-border)] bg-[var(--color-danger-surface)] p-3 text-[0.82rem] leading-6 text-[var(--color-danger-text)]"
          >
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </p>
        ) : null}

        {!authLoading && !signedIn ? (
          <p
            data-testid="rescue-signin-notice"
            className="mt-4 rounded-[var(--radius-panel)] border border-[var(--color-info-border)] bg-[var(--color-info-surface)] p-3 text-[0.82rem] leading-6 text-[var(--color-foreground)]"
          >
            <Link
              href="/login?next=/rescue-request"
              className="font-semibold text-[var(--color-primary)] underline-offset-4 hover:underline"
            >
              Sign in
            </Link>{" "}
            to send a rescue request so responders can follow up with you safely.
          </p>
        ) : null}

        <hr className="my-5 border-[color:color-mix(in_srgb,var(--color-border)_70%,transparent)]" />

        <button
          type="submit"
          disabled={submitDisabled}
          data-testid="rescue-submit"
          className="inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--color-primary)] px-4 py-3 text-[0.92rem] font-semibold text-white shadow-[var(--shadow-primary)] transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? (
            <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" />
          ) : (
            <LifeBuoy className="h-4 w-4 shrink-0" />
          )}
          <span>{submitting ? "Sending request..." : "Send Rescue Request"}</span>
        </button>

        <p className="mt-2.5 text-center text-[0.74rem] text-[var(--color-muted-foreground)]">
          By submitting, you confirm this is a genuine request. False reports delay
          real rescues.
        </p>
      </form>

      <ReportCameraCapture
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(file, capturedAt) => {
          attachPhoto(file, capturedAt);
          setCameraOpen(false);
        }}
        onUploadInstead={() => {
          setCameraOpen(false);
          fileInputRef.current?.click();
        }}
      />

      {locationPickerOpen ? (
        <IncidentLocationPicker
          open={locationPickerOpen}
          initialLocationName={fields.locationName}
          initialLatitude={fields.latitude}
          initialLongitude={fields.longitude}
          onClose={() => setLocationPickerOpen(false)}
          onConfirm={(location) => {
            setLocationSource(location.source);
            setGpsAccuracyMeters(null);
            setFields((current) => ({
              ...current,
              locationName: location.locationName,
              latitude: location.latitude,
              longitude: location.longitude,
            }));
            setErrorMessage(null);
            setLocationPickerOpen(false);
          }}
        />
      ) : null}
    </>
  );
}
```

- [x] **Step 2: Verify it typechecks and lints**

Run: `npm run typecheck && npm run lint`

Expected: both exit 0. If `Map` collides with the `Map` global in a lint rule, note that it is imported as `Map as MapIcon` and used only as `MapIcon`.

- [x] **Step 3: Commit**

```bash
git add components/rescue-request-form.tsx
git commit -m "feat: add rescue request form card

Location controls reusing the incident location picker and geolocation,
a clamped people stepper, mutually exclusive assistance tags, photo
attachment via file picker or the existing camera capture, and the
sign-in notice shown to anonymous visitors.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Page content and submit orchestration

**Files:**
- Create: `components/rescue-request-content.tsx`

**Interfaces:**
- Consumes: `RescueRequestForm` (Task 5), `RescueRequestCard` (Task 4), `RescueRequestAside` (Task 3); `SAMPLE_RESCUE_REQUESTS`, `buildPendingTimeline`, `RescueRequestRecord` (Task 1); `buildRescueRequestDescription`, `RESCUE_REPORT_CATEGORY`, `RESCUE_REPORT_SEVERITY`, `RESCUE_REPORT_TITLE`, `RescueRequestSubmission` (Task 2); `useAuthSession` from `@/components/auth-session-provider`.
- Produces: `function RescueRequestContent(): JSX.Element` — no props. Consumed by `DashboardShell` in Task 7.

- [x] **Step 1: Write the component**

Create `components/rescue-request-content.tsx`:

```tsx
"use client";

import { useState } from "react";
import { CircleCheck, LifeBuoy } from "lucide-react";

import { useAuthSession } from "@/components/auth-session-provider";
import { RescueRequestAside } from "@/components/rescue-request-aside";
import { RescueRequestCard } from "@/components/rescue-request-card";
import { RescueRequestForm } from "@/components/rescue-request-form";
import {
  SAMPLE_RESCUE_REQUESTS,
  buildPendingTimeline,
  type RescueRequestRecord,
} from "@/lib/rescue-request-data";
import {
  RESCUE_REPORT_CATEGORY,
  RESCUE_REPORT_SEVERITY,
  RESCUE_REPORT_TITLE,
  buildRescueRequestDescription,
  formatRescuePeopleLabel,
  type RescueRequestSubmission,
} from "@/lib/rescue-request-form";

function formatClockTime(date: Date) {
  return date.toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Sample ids follow RR-YYMM-NNNN, so locally filed ones do too. */
function buildLocalRequestId(date: Date) {
  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const sequence = String(Math.floor(Math.random() * 10_000)).padStart(4, "0");

  return `RR-${year}${month}-${sequence}`;
}

/**
 * Public Request Rescue view.
 *
 * Submissions go through the shared flood-report endpoint as a critical
 * "Rescue Needed" report. The listed requests are sample records - there is no
 * RescueRequest model yet - with anything filed in this session prepended so
 * the user sees their submission land.
 */
export function RescueRequestContent() {
  const { user, isLoading: authLoading } = useAuthSession();
  const [requests, setRequests] = useState<RescueRequestRecord[]>(
    SAMPLE_RESCUE_REQUESTS,
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSubmit(submission: RescueRequestSubmission) {
    const description = buildRescueRequestDescription({
      situation: submission.situation,
      peopleCount: submission.peopleCount,
      assistanceTagIds: submission.assistanceTagIds,
      contactNumber: submission.contactNumber,
    });

    const body = new FormData();
    body.set("title", RESCUE_REPORT_TITLE);
    body.set("description", description);
    body.set("category", RESCUE_REPORT_CATEGORY);
    body.set("severity", RESCUE_REPORT_SEVERITY);
    body.set("locationName", submission.locationName);
    body.set("latitude", submission.latitude);
    body.set("longitude", submission.longitude);
    body.set("locationSource", submission.locationSource);

    if (submission.gpsAccuracyMeters !== null) {
      body.set("gpsAccuracyMeters", String(submission.gpsAccuracyMeters));
    }

    if (user?.displayName) {
      body.set("reportedByName", user.displayName);
    }

    if (submission.photo) {
      body.set("image", submission.photo);
    }

    if (submission.photoCapturedAt) {
      body.set("photoCapturedAt", submission.photoCapturedAt.toISOString());
    }

    const response = await fetch("/api/reports", { method: "POST", body });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        payload && typeof payload.error === "string"
          ? payload.error
          : "Unable to send your rescue request. Try again in a moment.";

      throw new Error(message);
    }

    const now = new Date();
    const clockTime = formatClockTime(now);

    setRequests((current) => [
      {
        id: buildLocalRequestId(now),
        statusLabel: "Request Received",
        complete: false,
        locationName: submission.locationName,
        peopleCount: submission.peopleCount,
        submittedLabel: `Today, ${clockTime}`,
        assignedTeam: null,
        assistanceTagIds: submission.assistanceTagIds,
        description: submission.situation.trim(),
        timeline: buildPendingTimeline(clockTime),
      },
      ...current,
    ]);

    setSuccessMessage(
      `Rescue request sent for ${formatRescuePeopleLabel(submission.peopleCount)}. Keep your phone reachable.`,
    );

    return true;
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-[var(--color-background)]">
      <div className="mx-auto flex min-h-full w-full max-w-[1320px] flex-col gap-6 px-4 py-5 pb-[calc(env(safe-area-inset-bottom)+2rem)] md:px-7 md:py-7 xl:px-10">
        <section className="border-b border-[var(--color-border)] pb-5">
          <h1 className="text-[2.1rem] font-semibold leading-tight tracking-[-0.04em] text-[var(--color-foreground)]">
            Request Rescue Assistance
          </h1>
          <p className="mt-1.5 max-w-[760px] text-[1rem] leading-7 text-[var(--color-muted-foreground)]">
            Send your location and situation to local response teams. Help is
            coordinated by area — stay calm, stay safe, and keep your phone
            reachable.
          </p>
        </section>

        <section className="flex items-start gap-3 rounded-[var(--radius-card)] border border-[var(--color-info-border)] bg-[var(--color-info-surface)] p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-[color:color-mix(in_srgb,var(--color-primary)_16%,transparent)] text-[var(--color-primary)]">
            <LifeBuoy className="h-5 w-5" />
          </span>

          <div className="min-w-0">
            <h2 className="text-[0.95rem] font-semibold text-[var(--color-foreground)]">
              You are not alone — help is being organized.
            </h2>
            <p className="mt-1 text-[0.86rem] leading-6 text-[var(--color-muted-foreground)]">
              Every request is routed to the nearest available rescue team. Provide
              clear details below so responders can reach you faster.
            </p>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className="flex min-w-0 flex-col gap-6">
            {successMessage ? (
              <p
                role="status"
                data-testid="rescue-success"
                className="flex items-start gap-2 rounded-[var(--radius-panel)] border border-[var(--color-success-border)] bg-[var(--color-success-surface)] p-3 text-[0.86rem] leading-6 text-[var(--color-success-text)]"
              >
                <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{successMessage}</span>
              </p>
            ) : null}

            <RescueRequestForm
              signedIn={Boolean(user)}
              authLoading={authLoading}
              onSubmit={handleSubmit}
            />

            <section>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[1.25rem] font-semibold tracking-[-0.02em] text-[var(--color-foreground)]">
                  My Rescue Requests
                </h2>
                <span
                  data-testid="rescue-request-count"
                  className="text-[0.82rem] text-[var(--color-muted-foreground)]"
                >
                  {requests.length === 1 ? "1 request" : `${requests.length} requests`}
                </span>
              </div>

              <div className="mt-3 flex flex-col gap-4">
                {requests.map((request) => (
                  <RescueRequestCard key={request.id} request={request} />
                ))}
              </div>
            </section>
          </div>

          <aside className="min-w-0 lg:sticky lg:top-5">
            <RescueRequestAside />
          </aside>
        </div>
      </div>
    </div>
  );
}
```

**Important:** `handleSubmit` throws on failure, but `RescueRequestForm` awaits it inside a `try/finally` that does not catch. Fix this in Step 2 — the form must show the API error rather than producing an unhandled rejection.

- [x] **Step 2: Make the form surface thrown submit errors**

Edit `components/rescue-request-form.tsx`. Replace the `try { ... } finally { ... }` block inside `handleSubmit` with:

```tsx
    try {
      const accepted = await onSubmit({
        locationName: fields.locationName.trim(),
        latitude: fields.latitude,
        longitude: fields.longitude,
        locationSource,
        gpsAccuracyMeters,
        peopleCount,
        assistanceTagIds,
        situation: fields.situation,
        contactNumber: fields.contactNumber,
        photo,
        photoCapturedAt,
      });

      if (accepted) {
        resetForm();
      }
    } catch (cause) {
      setErrorMessage(
        cause instanceof Error && cause.message
          ? cause.message
          : "Unable to send your rescue request. Try again in a moment.",
      );
    } finally {
      setSubmitting(false);
    }
```

- [x] **Step 3: Verify it typechecks and lints**

Run: `npm run typecheck && npm run lint`

Expected: both exit 0.

- [x] **Step 4: Commit**

```bash
git add components/rescue-request-content.tsx components/rescue-request-form.tsx
git commit -m "feat: add rescue request page content

Two-column layout with the intro banner, form, request list, and support
aside. Submits through the shared reports endpoint as a critical Rescue
Needed report and prepends the accepted request to the list.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Shell integration and routing

**Files:**
- Modify: `lib/constants.ts` (the `NAV_ITEMS` array at line 38)
- Modify: `components/dashboard-shell.tsx` (the `pageMode` union around line 101; `getActiveItemFromPageMode` at line 219; the view flags around line 258; `handleSelect` at line 910; the view switch around line 1401)
- Modify: `app/rescue-request/page.tsx`
- Delete: `components/rescue-request-page.tsx`

**Interfaces:**
- Consumes: `RescueRequestContent` from Task 6.
- Produces: the `/rescue-request` route rendered inside the shell with the sidebar item active.

- [x] **Step 1: Add the nav item**

In `lib/constants.ts`, add `LifeBuoy` to the existing `lucide-react` import, then update `NAV_ITEMS`:

```ts
export const NAV_ITEMS: NavItem[] = [
  { id: "flood-map", label: "Flood Map", icon: Map },
  { id: "weather-monitoring", label: "Weather Monitoring", icon: CloudRain },
  { id: "evacuation-centers", label: "Evacuation Centers", icon: Building2 },
  { id: "incident-reports", label: "Incident Reports", icon: AlertCircle },
  { id: "rescue-request", label: "Request Rescue", icon: LifeBuoy },
  { id: "emergency-hotlines", label: "Emergency Hotlines", icon: PhoneCall },
  { id: "about", label: "About / How It Works", icon: Info },
];
```

- [x] **Step 2: Register the page mode in the shell**

In `components/dashboard-shell.tsx`, make these five edits.

Add the import next to the other content imports:

```tsx
import { RescueRequestContent } from "@/components/rescue-request-content";
```

Extend the `pageMode` union in `DashboardShellProps`:

```tsx
type DashboardShellProps = {
  pageMode?:
    | "flood-map"
    | "weather-monitoring"
    | "evacuation-centers"
    | "incident-reports"
    | "rescue-request"
    | "emergency-hotlines"
    | "about";
};
```

Extend `getActiveItemFromPageMode`:

```tsx
function getActiveItemFromPageMode(
  pageMode: NonNullable<DashboardShellProps["pageMode"]>,
) {
  return pageMode === "flood-map"
    ? "flood-map"
    : pageMode === "weather-monitoring"
      ? "weather-monitoring"
      : pageMode === "evacuation-centers"
        ? "evacuation-centers"
        : pageMode === "incident-reports"
          ? "incident-reports"
          : pageMode === "rescue-request"
            ? "rescue-request"
            : pageMode === "emergency-hotlines"
              ? "emergency-hotlines"
              : pageMode === "about"
                ? "about"
                : "flood-map";
}
```

Add the view flag and include it in `isContentOnlyView`:

```tsx
  const isIncidentReportsView = pageMode === "incident-reports";
  const isRescueRequestView = pageMode === "rescue-request";
  const isEmergencyHotlinesView = pageMode === "emergency-hotlines";
  const isAboutView = pageMode === "about";
  const isContentOnlyView =
    isWeatherMonitoringView ||
    isEvacuationCentersView ||
    isIncidentReportsView ||
    isRescueRequestView ||
    isEmergencyHotlinesView ||
    isAboutView;
```

Add the route branch in `handleSelect`, after the `incident-reports` branch:

```tsx
    if (id === "rescue-request") {
      router.push("/rescue-request");
      return;
    }
```

Add the render branch in the `<main>` view switch, after `isIncidentReportsView`:

```tsx
            ) : isRescueRequestView ? (
              <RescueRequestContent />
```

- [x] **Step 3: Point the route at the shell and delete the stub**

Replace the contents of `app/rescue-request/page.tsx` with:

```tsx
import { DashboardShell } from "@/components/dashboard-shell";

export default function RescueRequestPage() {
  return <DashboardShell pageMode="rescue-request" />;
}
```

Then remove the superseded stub:

```bash
git rm components/rescue-request-page.tsx
```

- [x] **Step 4: Verify nothing else referenced the stub**

Run: `grep -rn "rescue-request-page" app components lib tests`

Expected: no output. If anything is found, update it to `@/components/rescue-request-content`.

- [x] **Step 5: Verify it typechecks, lints, and builds**

Run: `npm run lint && npm run typecheck && npm test`

Expected: all three exit 0.

- [x] **Step 6: Commit**

```bash
git add lib/constants.ts components/dashboard-shell.tsx app/rescue-request/page.tsx components/rescue-request-page.tsx
git commit -m "feat: route Request Rescue through the dashboard shell

Adds the sidebar item between Incident Reports and Emergency Hotlines,
registers the rescue-request page mode as a content-only view, and drops
the superseded standalone stub.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Browser coverage and full verification

**Files:**
- Create: `tests/browser/rescue-request.spec.ts`

**Interfaces:**
- Consumes: the `data-testid` attributes added in Tasks 5 and 6 — `rescue-request-form`, `rescue-use-current-location`, `rescue-choose-on-map`, `rescue-location-name`, `rescue-people-decrement`, `rescue-people-increment`, `rescue-people-count`, `rescue-assistance-<tagId>`, `rescue-situation`, `rescue-contact`, `rescue-photo-upload`, `rescue-form-error`, `rescue-signin-notice`, `rescue-submit`, `rescue-request-count`, `rescue-success`.
- Produces: nothing consumed by later tasks.

- [x] **Step 1: Write the failing test**

Create `tests/browser/rescue-request.spec.ts`:

```ts
import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page) {
  await page.goto("/rescue-request");
  const origin = new URL(page.url()).origin;
  const response = await page.request.post("/api/auth/register", {
    headers: { Origin: origin, "Content-Type": "application/json" },
    data: JSON.stringify({
      email: `rescue-request-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`,
      password: "correct-horse-battery",
    }),
  });
  expect(response.status()).toBe(201);
  await page.reload();
}

test.describe("Request Rescue page", () => {
  test("renders the form, sample requests, and the support aside", async ({
    page,
  }) => {
    await page.goto("/rescue-request");

    await expect(
      page.getByRole("heading", { name: "Request Rescue Assistance" }),
    ).toBeVisible();
    await expect(page.getByTestId("rescue-request-form")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "My Rescue Requests" }),
    ).toBeVisible();
    await expect(page.getByTestId("rescue-request-count")).toHaveText("2 requests");

    // The aside is page-owned, not the shared right info panel.
    await expect(page.getByRole("heading", { name: "While you wait" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Emergency hotlines" }),
    ).toBeVisible();

    // Sample data must stay scoped to Calumpit.
    await expect(page.getByText("Calumpit Rescue 4")).toBeVisible();
    await expect(page.getByText(/Marikina/i)).toHaveCount(0);
  });

  test("the sidebar marks Request Rescue as the active section", async ({ page }) => {
    await page.goto("/rescue-request");

    await expect(page.getByText("Current section")).toBeVisible();
    await expect(
      page.locator("aside").getByRole("button", { name: "Request Rescue" }),
    ).toBeVisible();
  });

  test("the people stepper clamps at one and counts up", async ({ page }) => {
    await page.goto("/rescue-request");

    const count = page.getByTestId("rescue-people-count");
    await expect(count).toHaveText("1");

    await page.getByTestId("rescue-people-decrement").click();
    await expect(count).toHaveText("1");

    await page.getByTestId("rescue-people-increment").click();
    await page.getByTestId("rescue-people-increment").click();
    await expect(count).toHaveText("3");
    await expect(page.getByText("3 people")).toBeVisible();
  });

  test("None and the real assistance needs are mutually exclusive", async ({
    page,
  }) => {
    await page.goto("/rescue-request");

    const children = page.getByTestId("rescue-assistance-children");
    const none = page.getByTestId("rescue-assistance-none");

    await children.click();
    await expect(children).toHaveAttribute("aria-pressed", "true");

    await none.click();
    await expect(none).toHaveAttribute("aria-pressed", "true");
    await expect(children).toHaveAttribute("aria-pressed", "false");

    await children.click();
    await expect(children).toHaveAttribute("aria-pressed", "true");
    await expect(none).toHaveAttribute("aria-pressed", "false");
  });

  test("anonymous visitors see the sign-in notice and a disabled submit", async ({
    page,
  }) => {
    await page.goto("/rescue-request");

    await expect(page.getByTestId("rescue-signin-notice")).toBeVisible();
    await expect(page.getByTestId("rescue-submit")).toBeDisabled();
  });

  test("a signed-in visitor submitting an unpinned form gets a clear error", async ({
    page,
  }) => {
    await signIn(page);

    await expect(page.getByTestId("rescue-signin-notice")).toHaveCount(0);
    await expect(page.getByTestId("rescue-submit")).toBeEnabled();

    await page.getByTestId("rescue-location-name").fill("Brgy. Meysulao");
    await page
      .getByTestId("rescue-situation")
      .fill("Water is chest deep and still rising outside.");
    await page.getByTestId("rescue-submit").click();

    await expect(page.getByTestId("rescue-form-error")).toContainText(
      "Pin your location",
    );
  });

  test("the layout has no horizontal overflow on a phone viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/rescue-request");

    await expect(page.getByTestId("rescue-request-form")).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
```

- [x] **Step 2: Run the browser spec**

Run: `npx playwright test tests/browser/rescue-request.spec.ts`

Expected: all 7 tests PASS. Playwright starts the dev server itself via the `webServer` block in `playwright.config.ts`.

If a test fails, fix the component — not the test — unless the test's expectation is provably wrong about the reference design. Common causes:
- The sidebar button name assertion fails → confirm the `NAV_ITEMS` label is exactly `"Request Rescue"`.
- The overflow assertion fails → find the element wider than its container (usually a fixed-width grid child) and give it `min-w-0`.

- [x] **Step 3: Run the full verification suite**

Run: `npm run lint && npm run typecheck && npm test && npm run build`

Expected: all four exit 0. Report the actual output; do not claim success without it.

- [x] **Step 4: Commit**

```bash
git add tests/browser/rescue-request.spec.ts
git commit -m "test: cover the Request Rescue page in the browser suite

Asserts the rendered form and sample list, the active sidebar item, the
people stepper clamp, assistance tag exclusivity, the anonymous sign-in
notice, validation messaging, and phone-viewport overflow.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review Notes

Checked against `docs/superpowers/specs/2026-09-10-request-rescue-page-design.md`:

- **Shell integration** → Task 7 covers all four listed edit sites plus the route file and stub deletion.
- **File breakdown** → Tasks 1, 3, 4, 5, 6 create the five components/modules; the `lib/rescue-request-form.ts` split is documented above as a refinement.
- **Page content** (header, banner, form sections, request list, aside) → Tasks 3, 5, 6.
- **Form behaviour** (geolocation, picker, stepper, tag exclusivity, photo, submit payload) → Tasks 2, 5, 6.
- **Authentication** → the sign-in notice and disabled submit are in Task 5; verified in Task 8.
- **Error handling** → validation in Task 2, geolocation and image errors in Task 5, API errors in Task 6 Step 2.
- **Responsive** → the grid, stacking, and `min-w-0` rules are in Tasks 5 and 6; the phone-viewport overflow check is in Task 8.
- **Styling** → constrained by Global Constraints and satisfied by the token usage in every component.
- **Testing** → Tasks 1, 2, and 8 plus the full suite run in Task 8 Step 3.

Type consistency: `RescueRequestRecord`, `RescueAssistanceTagId`, `RescueTimelineEntry`, and `RescueRequestSubmission` are defined once (Tasks 1 and 2) and referenced with the same names in Tasks 4, 5, and 6. `formatRescuePeopleLabel` is used in Tasks 4 and 6; `clampRescuePeopleCount` and `toggleRescueAssistanceTag` in Task 5.
