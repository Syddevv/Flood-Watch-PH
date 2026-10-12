# Request Rescue page — design

Date: 2026-09-10
Status: Approved

## Goal

Add a public-facing **Request Rescue** page that matches the supplied UI reference: a
guided rescue-request form plus a "My Rescue Requests" list with per-request status
timelines, and a supporting aside (safety tips, hotlines, disclaimer). The page must be
fully responsive on mobile and use only the existing FloodWatch PH font and colour
tokens.

## Scope decisions

Settled during brainstorming:

- **Data layer: UI-only with sample request data.** No `RescueRequest` Prisma model
  exists, and `components/admin-rescue-requests.tsx` still runs on hardcoded preview
  data. The "My Rescue Requests" list is therefore driven by local sample data, while
  form submission wires to the existing `POST /api/reports` endpoint with category
  `"Rescue Needed"`. Introducing a dedicated rescue-request model and API is explicitly
  out of scope for this spec.
- **Reuse existing interactive components** for location picking and photo capture
  rather than writing lightweight duplicates.
- **Sample data is localized to Calumpit** (barangays, team names) rather than copying
  the reference's Marikina place names, because the rest of the app — including the
  location picker's boundary check — is Calumpit-scoped.

## Shell integration

`Request Rescue` becomes a first-class shell view, exactly like Incident Reports.

- `NAV_ITEMS` (`lib/constants.ts`) gains
  `{ id: "rescue-request", label: "Request Rescue", icon: LifeBuoy }`, inserted between
  `incident-reports` and `emergency-hotlines` to match the reference's sidebar order.
- `components/dashboard-shell.tsx`: add `"rescue-request"` to the `pageMode` union, to
  `getActiveItemFromPageMode`, to the `isContentOnlyView` set, and to `handleSelect`
  (routing to `/rescue-request`).
- `app/rescue-request/page.tsx` renders `<DashboardShell pageMode="rescue-request" />`.
- The existing standalone stub `components/rescue-request-page.tsx` is replaced by the
  new content component and removed.

Because it is a content-only view, the main region spans the map and right-panel grid
columns. The reference's right-hand cards are therefore **page-owned**, not the shared
`RightInfoPanel`.

## File breakdown

Each file has one clear purpose; no single component absorbs the whole page.

| File | Responsibility |
| --- | --- |
| `lib/rescue-request-data.ts` | Types plus Calumpit-localized sample requests, timeline stages, assistance-tag definitions, "while you wait" tips, and hotline rows |
| `components/rescue-request-content.tsx` | Page layout: header, intro banner, two-column grid, submit orchestration, request-list state |
| `components/rescue-request-form.tsx` | The form card (911 strip, location, people count, assistance tags, description, contact, photo, submit) |
| `components/rescue-request-card.tsx` | A single request card and its status timeline |
| `components/rescue-request-aside.tsx` | "While you wait", "Emergency hotlines", and disclaimer cards |

### Interfaces

- `rescue-request-data.ts` exports `RescueRequestRecord`, `RescueTimelineStage`,
  `AssistanceTag`, and the sample/constant collections. It holds no React.
- `RescueRequestForm` receives the submit handler, busy flag, error message, and
  auth state from its parent; it owns only its own field state.
- `RescueRequestCard` is presentational: one `RescueRequestRecord` in, markup out.
- `RescueRequestAside` is static presentational content.

## Page content

Reproducing the reference:

1. **Header** — "Request Rescue Assistance" with the sub-line about sending location and
   situation to local response teams.
2. **Intro banner** — lifebuoy icon, "You are not alone — help is being organized."
3. **Form card**, in order:
   - Red strip: "If life is in immediate danger, call 911 now."
   - "Where do you need help?" — `Use My Current Location` and `Choose on Map` buttons
     above a free-text location field.
   - "People needing assistance" — decrement/increment stepper with a live
     "1 person" / "N people" label.
   - "Special assistance needed" — six toggle cards: Children, Elderly, Person with
     disability, Pregnant person, Medical needs, None.
   - "Describe your situation" textarea.
   - "Contact number" field.
   - "Add a photo (optional)" dropzone.
   - Full-width primary `Send Rescue Request` button and the false-reports footnote.
4. **My Rescue Requests** — heading with an "N requests" count, then cards showing the
   request ID, status pill, address, meta row (people / time / assigned team),
   assistance tags, description, and a five-stage status timeline
   (Request Received → Team Dispatched → Team En Route → Team On Scene →
   Rescue Complete).
5. **Aside** — "While you wait" tips, "Emergency hotlines" (911, NDRRMC, Philippine
   Coast Guard) with the call-911-first note, and the community-assist disclaimer.

## Form behaviour

- **Location.** `Use My Current Location` calls `navigator.geolocation` and resolves a
  readable name via the existing `resolveReportLocationName`. `Choose on Map` opens the
  existing `IncidentLocationPicker` modal (map plus search, Calumpit-bounded). Both
  write into the shared text field, which also accepts typed input.
- **People stepper.** Clamped to 1–50.
- **Assistance tags.** Multi-select. Selecting `None` clears the others; selecting any
  other tag clears `None`.
- **Photo.** The dropzone opens a file picker, with the existing `ReportCameraCapture`
  component as the take-a-photo path. Once set, a thumbnail with a remove control is
  shown.
- **Submit.** `POST /api/reports` as `multipart/form-data` with category
  `"Rescue Needed"`, severity `"Critical"`, a description assembled from the situation
  text plus people count, assistance tags, and contact number, and an `image` field when
  a photo is attached.

## Authentication

`POST /api/reports` returns 401 for anonymous users. Following the pattern in
`components/incident-reports-content.tsx`, the page renders fully for everyone, but when
no user is signed in an inline "Sign in to send a rescue request" notice appears above
the submit button, linking to `/login?next=/rescue-request`, and the submit button is
disabled. There is no full-page auth gate.

## Error handling

A single inline banner at the top of the form card reports:

- geolocation denied or unavailable,
- coordinates outside Calumpit (reusing `OUTSIDE_CALUMPIT_ERROR_MESSAGE`),
- missing location or missing/too-short description,
- image rejected by the upload endpoint,
- any API failure, using the endpoint's error message when present.

On success the form resets and a new request is prepended to the list with a
`Request Received` timeline stage.

## Responsive behaviour

- `lg` and wider: form column plus sticky aside, `lg:grid-cols-[minmax(0,1fr)_320px]`.
- Below `lg`: single column, with the aside stacked beneath the request list.
- Assistance grid: one column, `sm:` two, `lg:` three.
- Location buttons stack on mobile.
- Timeline rows, card meta rows, and status pills wrap rather than overflow.
- The content column scrolls inside `h-full overflow-y-auto`, matching sibling views,
  with bottom padding for the safe-area inset.

## Styling

Only existing tokens are used — `--color-surface`, `--color-panel`, `--color-border`,
`--color-primary`, the `--color-danger*` / `--color-success*` / `--color-warning*` sets,
`--radius-card`, `--shadow-soft`, and `--font-app-sans` / `--font-app-mono` — so both
light and dark themes work without new palette entries. Request IDs use the mono token.
Timeline states map to warning (done), primary (current), and muted (pending).

## Testing

- `npx tsc --noEmit` and the project's lint command must pass.
- A Playwright spec in `tests/`, following existing conventions, covering: the page
  renders at `/rescue-request`, the sidebar item is active, the people stepper and
  assistance toggles behave (including the `None` exclusivity rule), and an
  unauthenticated visitor sees the sign-in notice with the submit button disabled.

## Out of scope

- A `RescueRequest` Prisma model, migration, or dedicated API routes.
- Wiring `components/admin-rescue-requests.tsx` to real data.
- Real-time status updates or responder-side workflows.
