# FloodWatch PH — Additional Features TODO

> **Purpose:** This document serves as the implementation roadmap for coding agents working on the next phase of FloodWatch PH.
> **Priority order:** Tasks are arranged from **highest priority to lowest priority**.
> **General rule:** Preserve existing functionality unless a task explicitly requires a behavior change. Before implementing a feature, inspect the existing architecture, database schema, API routes, components, and current reporting workflow.

---

## Priority 0 — Critical Architecture & Data Integrity ✅ Done (2026-08-23)

### 1. Decide and Implement Handling for Reports at the Same Location

**Priority:** 🔴 Critical — **Status: Implemented and verified.**

The reporting system must have a clear, server-enforced strategy for multiple flood reports referring to the same physical location.

> **Implementation summary:** Added a first-class `Incident` model (`prisma/schema.prisma`, migration `prisma/migrations/20260823_incident_grouping/`). `FloodReport` now requires an `incidentId`. Matching is server-enforced inside the `POST /api/reports` transaction (`app/api/reports/route.ts`) using a configurable radius/time-window matcher (`lib/incident-matching.ts`, `lib/incident-config.ts`) and Postgres advisory-lock concurrency safety (`lib/incident-geo-lock.ts`, `lib/prisma.ts`). Incident status rolls up from constituent reports (`lib/incident-lifecycle.ts`, `lib/incident-sync.ts`, wired into the confirm/resolve routes). Frontend surfaces this in `components/incident-reports-content.tsx` (nearby-duplicate warning, `forceNewIncident` flag, incident badges) and `components/flood-map-client.tsx` (popup "N related reports"). Existing data was backfilled with zero loss (every pre-existing report became its own singleton incident). One separately-discovered and fixed bug: a stale `useEffect` dependency in the nearby-duplicate warning UI caused it to flicker and clear itself before a user could interact with it — fixed and covered by `tests/browser/nearby-duplicate-warning.spec.ts`.
>
> **Not yet verified:** mobile viewport / touch interaction (only desktop Chromium and direct API testing were performed this pass).

#### Requirements

- [x] Inspect the current report creation and matching logic.
- [x] Determine how reports should be grouped when they represent the same flooding incident.
- [x] Define what constitutes a "same location" report.
- [x] Use a configurable geographic radius rather than requiring exact latitude/longitude equality. (`INCIDENT_MATCH_RADIUS_METERS`, default 300m, env-overridable)
- [x] Consider report recency/time when determining whether reports belong to the same incident. (`INCIDENT_MATCH_TIME_WINDOW_MS`, default 12h, compared against `lastActivityAt`)
- [x] Prevent duplicate reports from unnecessarily creating separate incidents.
- [x] Still allow users to submit a new report when the situation has materially changed. (`forceNewIncident` flag)
- [x] Preserve individual user reports as historical records.
- [x] Do not silently delete or overwrite existing reports.
- [x] Make the matching logic server-enforced so clients cannot bypass it.
- [x] Ensure concurrent report submissions cannot create inconsistent incident relationships. (verified live: 5 simultaneous submissions at one spot converged on exactly one incident)
- [x] Add appropriate database indexes for geographic/time-based lookup where practical.
- [x] Update the UI to clearly explain when a report appears to correspond to an existing incident.
- [x] Allow users to contribute information to an existing incident when appropriate.
- [x] Allow an explicitly separate report/incident when the user indicates that it is a different situation.
- [ ] Ensure the final behavior works correctly on desktop and mobile. *(desktop verified; mobile viewport not yet tested)*

#### Data integrity

- [x] Define the relationship between `Report` and `Incident` if an incident abstraction is used. (dedicated `Incident` table, `FloodReport.incidentId` FK)
- [x] Ensure reports remain individually attributable to their submitting users.
- [x] Store creation/update timestamps consistently.
- [x] Ensure incident status can be updated without destroying the original report data. (separate `Incident.status`, rolled up via `lib/incident-lifecycle.ts`)
- [x] Add migrations only after validating the existing production/development schema.
- [x] Update Prisma models and generated client where necessary.
- [x] Add tests for duplicate/same-location scenarios.

#### Test cases

- [x] Two reports within the matching radius and time window.
- [x] Two reports at exactly the same coordinates.
- [x] Two reports slightly outside the matching radius.
- [x] Two reports at the same location but far apart in time. *(unit-tested; not exercised at the integration level — the harness uses a real server clock and can't fast-forward it)*
- [x] Multiple users reporting simultaneously. (5-way concurrency, live-verified against the dev database)
- [x] Same user submitting multiple reports.
- [x] Existing incident with several contributing reports.
- [x] User intentionally creating a separate incident.
- [x] Reports near the boundary of Calumpit. *(closed by Priority 2: the geofence in `parseReportDetailsFormData` sits upstream of incident matching, so a report just inside the boundary is matched exactly like any other and one just outside never reaches matching at all — covered by `tests/calumpit-boundary.test.ts` edge cases plus the untouched P0 regression guard in `tests/incident-matching.test.ts`.)*

---

## Priority 1 — Authentication & User Accountability ✅ Done (2026-08-26)

### 2. Require Users to Create an Account

**Priority:** 🔴 Critical — **Status: Implemented and verified.**

FloodWatch PH should move from anonymous reporting toward authenticated reporting.

> **Implementation summary:** Added `User` and `Session` models (DB-backed, revocable sessions — not the anonymous cookie's stateless HMAC pattern), migration `prisma/migrations/20260826_user_accounts/`. New `app/api/auth/{register,login,logout,session}/route.ts` endpoints, password hashing via Node's built-in `crypto.scrypt` (`lib/password.ts`, no new dependency), session cookie handling in `lib/auth-session.ts`/`lib/auth-session-token.ts`/`lib/cookies.ts` (the last extracted from `lib/report-session.ts` to share the cookie-parsing convention). `POST /api/reports` now hard-requires authentication (401 if signed out) and stamps `userId` instead of the anonymous `ownerSessionHash` on new reports. `isReportOwner`/`canAccessArchivedReport`/`serializeReportRecord` (`lib/report-api.ts`) became dual-mode — reports created before this shipped keep working via their `ownerSessionHash` for their original anonymous session, new reports are owned via `userId`, and an admin-role bypass exists in the check (no admin UI yet — that's Priority 5). Frontend: `app/login/page.tsx`, `app/register/page.tsx`, `components/auth-session-provider.tsx` (mounted in `app/layout.tsx` alongside the existing anonymous-session provider), a login/account chip in `components/app-header.tsx`, and the report form in `components/incident-reports-content.tsx` now shows a "sign in to report" prompt in place of the form when signed out — the server-side 401 remains the actual enforcement.
>
> Verified live end-to-end (register → create report → wrong/right password login → session check → logout → re-gate; a synthetic pre-existing anonymous-owned report confirmed still editable by its original session and rejected for others) and via a real-browser Playwright pass. Rescue requests as a distinct entity don't exist yet (Priority 6), so "require authentication before submitting a rescue request" isn't separately actionable — "Rescue Needed" still flows through the same now-authenticated report path. The admin dashboard itself (Priority 5) wasn't built; only the `role` field and the authorization primitive exist.
>
> **Not yet verified:** mobile viewport / touch interaction for the login/register forms and header chip (same gap noted for Priority 0).

#### Requirements

- [x] Inspect the existing authentication architecture before introducing a new system.
- [x] Require authentication before submitting a flood report.
- [ ] Require authentication before submitting a rescue request. *(no separate rescue-request entity exists yet — deferred to Priority 6; the shared report path is now authenticated)*
- [x] Preserve public access to viewing the flood map unless requirements state otherwise.
- [x] Clearly distinguish public map access from authenticated actions.
- [x] Associate every report with the authenticated user. (`FloodReport.userId`, new reports only — pre-existing reports keep their anonymous `ownerSessionHash`)
- [ ] Associate every rescue request with the authenticated user. *(deferred with the item above — Priority 6)*
- [x] Prevent spoofing another user's identity. (dual-mode ownership check, session tokens hashed before storage, generic login-failure messaging to prevent user enumeration)
- [x] Validate authorization on the server/API layer.
- [x] Do not rely solely on client-side route protection. (the form gate is UX only; `POST /api/reports` enforces the real 401 server-side)
- [x] Add appropriate login/register/logout flows.
- [x] Add session handling and expiration. (30-day DB-backed sessions, real revocation on logout)
- [x] Handle unauthenticated users gracefully when they attempt restricted actions.
- [x] Preserve existing report links and public report viewing where possible.
- [x] Update the UI to communicate which actions require an account.
- [ ] Ensure mobile authentication flows work correctly. *(not yet tested on a mobile viewport)*

#### User data

- [x] Define the minimum user information required. (email + password only; display name optional)
- [x] Avoid collecting unnecessary personal information.
- [x] Store passwords securely using the chosen authentication solution. (`crypto.scrypt`, random per-user salt, timing-safe comparison)
- [x] Never expose password hashes or sensitive authentication data through API responses.
- [x] Add role support for regular users and administrators. (`User.role`, `"user"` default, `"admin"` supported — no admin UI yet)
- [x] Add database constraints/indexes where appropriate.

#### Authorization

- [x] Regular users can manage only actions they are authorized to perform.
- [x] Administrators can access administrative functionality. *(primitive only — `isReportOwner`'s admin-role bypass; no admin-only routes exist yet to exercise it end-to-end)*
- [x] Verify authorization on every protected API endpoint.
- [x] Do not rely on hidden UI elements as an authorization mechanism.

---

## Priority 2 — Calumpit Geographic Scope ✅ Done (2026-08-26)

### 3. Restrict the Main Map to Calumpit, Bulacan

**Priority:** 🔴 High — **Status: Implemented and verified.**

FloodWatch PH should operate primarily within the defined Calumpit, Bulacan geographic area.

> **Implementation summary (items 3 & 4 together):** The official boundary is the OpenStreetMap municipal polygon (relation 13255989, 533 points) committed verbatim in `lib/calumpit-boundary.ts` alongside `CALUMPIT_CENTER`, the tight `CALUMPIT_BOUNDS`, the padded `CALUMPIT_MAP_MAX_BOUNDS` (~13 km, sized to keep Hagonoy/Malolos/Pulilan/Plaridel/Guiguinto/Balagtas evacuation centers reachable for Priority 3), a hand-rolled ray-casting `isWithinCalumpit` (no geo dependency added), and one shared `OUTSIDE_CALUMPIT_ERROR_MESSAGE`. Server enforcement lives in `parseReportDetailsFormData` (`lib/report-api.ts`), which both `POST /api/reports` and `PATCH /api/reports/[id]` run — reports can be neither created nor edited to sit outside Calumpit. Per the confirmed decision, existing out-of-area reports are **hidden, not deleted**: `GET /api/reports` and `GET /api/map/all` bbox-prefilter on the existing `[latitude, longitude]` index and polygon-filter in JS, while `GET /api/reports/[id]` is untouched so share links keep working; evacuation centers are a separate data path and were not filtered. Main map (`components/flood-map-client.tsx`, `flood-map.tsx`): opens fitted to Calumpit, `minZoom 11`, hard `maxBounds` at the padded box, a dark translucent mask dimming everything outside the municipality plus a bold dashed boundary, a legend entry, and a "Coverage: Calumpit, Bulacan only" chip. Location picker (`components/incident-location-picker-map.tsx`, `incident-location-picker.tsx`): same bounds/overlay, red "!" pin + warning + disabled "Outside Calumpit" button for out-of-area pins on desktop and mobile (the mobile footer previously had no error slot at all). Report form (`components/incident-reports-content.tsx`): manual coordinates outside Calumpit show an inline message and disable submit before the rest of the form is filled; GPS fixes outside Calumpit are rejected (accuracy shown) and hand off to the picker; placeholders and header copy updated. Location search (`lib/weather.ts`) is biased toward the Calumpit area but not restricted. Seed reports relocated to Poblacion / Iba O'Este / Frances; the Metro Manila demo risk polygons (`FLOOD_POLYGONS`) were emptied rather than faked.
>
> Verified: 9 new boundary unit tests (including a bbox-inside/polygon-outside point proving a real polygon test), server 400 on a Marikina submission, list/map excluding out-of-area reports while a direct link still returns 200, and real-browser Playwright specs (`tests/browser/calumpit-picker-scope.spec.ts`: manual coordinates, picker inside→outside, stubbed GPS rejection) plus screenshot passes at 1440/390 px. `tests/browser/nearby-duplicate-warning.spec.ts` was also repaired — it had been silently broken since Priority 1.
>
> **Not yet verified:** real-device touch interaction (mobile viewports were screenshot-checked in desktop Chromium only, as with P0/P1).

#### Requirements

- [x] Define the official Calumpit geographic boundary. (OSM relation 13255989)
- [x] Determine whether the boundary should use:
  - [ ] Bounding box, or
  - [x] Polygon/geographic boundary.

- [x] Prefer an actual geographic boundary/polygon when feasible.
- [x] Update the map's initial viewport to Calumpit.
- [x] Prevent normal map navigation from making the application behave as though it supports arbitrary locations. (padded `maxBounds`, `minZoom 11`, outside-area mask)
- [x] Ensure map markers primarily represent locations within the supported reporting area. (report markers filtered server-side; evacuation centers intentionally not — they follow the separate nearby-radius rule from Priority 3)
- [x] Clearly communicate the supported geographic coverage in the UI. (boundary overlay, legend entry, coverage chip, form copy)
- [x] Avoid misleading users into believing the system supports all of Bulacan or the entire Philippines.

#### Backend enforcement

- [x] Validate report coordinates against the Calumpit boundary on the server.
- [x] Reject report submissions outside the supported reporting area.
- [x] Do not rely only on map UI restrictions.
- [x] Validate manually submitted coordinates as well.
- [x] Validate coordinates received through APIs. (create and edit both go through the same parser)
- [x] Add tests for locations inside and outside the boundary.

---

### 4. Restrict Reporting Scope to Calumpit, Bulacan

**Priority:** 🔴 High — **Status: Implemented and verified** (see the summary under item 3).

Only locations within the supported Calumpit reporting area should accept flood reports.

#### Requirements

- [x] Validate latitude/longitude during report creation.
- [x] Reject coordinates outside the Calumpit reporting boundary.
- [x] Display a clear error when a user attempts to report outside the area.
- [x] Ensure map picker cannot accidentally submit an unsupported location. (confirm disabled + hard guard in `handleConfirm`)
- [x] Ensure search-selected locations are validated. (search results land in the picker, which applies the same check)
- [x] Ensure GPS-selected locations are validated.
- [x] Ensure manually provided coordinates are validated.
- [x] Ensure existing report APIs cannot bypass the geographic restriction.
- [x] Add automated tests for boundary cases.

#### UX

- [x] Show the supported reporting area visually on the map.
- [x] Provide clear feedback when the selected location is outside Calumpit.
- [x] Avoid allowing users to complete the report form only to discover at the final submission step that the location is invalid. (inline coordinate validation disables submit immediately; picker blocks confirm)
- [x] Handle GPS accuracy/uncertainty gracefully near the boundary. (accuracy shown in the rejection message; a low-accuracy fix that is inside still succeeds with a "double-check the pin" note — no tolerance buffer, so client and server apply the identical rule)

---

## Priority 3 — Evacuation Center Coverage ✅ Done (2026-08-25)

### 5. Keep Nearby Bulacan Evacuation Centers Visible

**Priority:** 🟠 High — **Status: Implemented and verified.**

Although reporting should be restricted to Calumpit, nearby evacuation centers outside Calumpit should remain visible when they are relevant to people in the area.

> **Implementation summary:** Evacuation-center visibility now has its own rule, separate from the report geofence, in a new plain-TypeScript module `lib/evacuation-center-scope.ts` (no Prisma/`server-only` imports, so the map, the list page and the API route all share it). "Nearby" is defined as **within a configurable radius of `CALUMPIT_CENTER` *and* inside the padded `CALUMPIT_MAP_MAX_BOUNDS`** — the box clip keeps the list and the locked map in agreement (Santa Maria is 23.6 km away but outside the pannable box, so it is excluded; a unit test pins this so widening the box later surfaces it automatically). The radius is `NEXT_PUBLIC_EVACUATION_CENTER_NEARBY_RADIUS_KM` (default **25 km**, clamped 1–100; `NEXT_PUBLIC_` because the nearby set is computed client-side from the static dataset and an un-prefixed variable would cause a server/browser mismatch). With the defaults, exactly **8** Bulacan centers are nearby, sorted by distance: Calumpit 0.2 km, Malolos 8.9, Pulilan 9.1, Hagonoy 10.1, Plaridel 10.4, Guiguinto 15.2, Balagtas 15.4, Bocaue 21.6. The remaining 27 entries (Marilao, Meycauayan, Obando, SJDM, Santa Maria, and every Metro Manila / Rizal center) are **hidden, not deleted** — the dataset is untouched and the list page can still show them behind a toggle.
>
> Backend: `GET /api/map/all` serves only the nearby centers and reports `meta.evacuationCenterRadiusKm`; the route now carries the polygon rule for reports and the radius rule for centers side by side, which is the architectural expression of the principle. Map (`components/dashboard-shell.tsx`, `flood-map.tsx`, `flood-map-client.tsx`): markers use the nearby set; the "Nearby evacuation centers" sidebar panel is now derived from the four nearest centers instead of the old hard-coded featured list (which pointed at Marikina / San Jose del Monte / Antipolo); center markers are **violet rounded squares** (reports remain circles — shape *and* hue differ), the legend swatch was fixed to use the real marker colour (it previously showed green while every marker was light blue), and the coverage chip reads *"Reports: Calumpit only · Shelters: within 25 km"*. List page (`components/evacuation-centers-content.tsx`): shows the 8 nearby centers by default with "~N km from Calumpit" on every card, a "Show all 35 reference centers (outside coverage)" toggle (`aria-pressed`), an "Outside coverage" badge that sits *beside* the status badge rather than replacing it, and "Evacuation Center Near Me" / `?fromReport` ranking that only considers nearby centers so it can never recommend an NCR shelter. Old `?center=<id>` deep links to far centers still resolve. Search, status and facility filters apply on top of whichever set is active. No status values, verification badges, notes, DB schema or migrations changed. A data gap is recorded as a `TODO(data)` in `data/evacuation-centers.ts`: Apalit and Macabebe (Pampanga) border Calumpit and are inside the map box but have no reference center yet.
>
> Verified: 9 new unit tests (`tests/evacuation-center-scope.test.ts` — exact ordered nearby set, exclusions, sort order, map-box invariant, Santa Maria clip, env clamping, custom radius, "all nearby centers are still `needs_verification`" guard, featured derivation), `tests/calumpit-boundary.test.ts` extended with Bocaue, a production-build Playwright spec (`tests/browser/evacuation-center-scope.spec.ts`: list default vs. show-all with badges, API count/radius/province assertions, map caption + chip + legend), `curl /api/map/all` → 8 centers / 25 km / Bulacan only, and screenshot passes at 1440/390 px.
>
> **Not yet verified:** real-device touch interaction (same standing gap as P0–P2).

#### Requirements

- [x] Separate the **reporting boundary** from the **evacuation center visibility boundary**. (`isWithinCalumpit` polygon for reports vs. `isNearbyEvacuationCenter` radius + map box for centers)
- [x] Do not apply the Calumpit reporting restriction to evacuation center data.
- [x] Keep relevant nearby Bulacan evacuation centers visible. (8 centers across 8 municipalities)
- [x] Define what "nearby" means. (≤ radius from `CALUMPIT_CENTER` **and** inside `CALUMPIT_MAP_MAX_BOUNDS`)
- [x] Prefer a configurable distance/radius around Calumpit. (`NEXT_PUBLIC_EVACUATION_CENTER_NEARBY_RADIUS_KM`, default 25, clamped 1–100)
- [x] Ensure evacuation centers just outside Calumpit are not unnecessarily hidden. (Malolos, Pulilan, Hagonoy, Plaridel all inside the default radius; the full dataset remains one toggle away on the list page)
- [x] Clearly distinguish evacuation center markers from flood report markers. (rounded-square violet "E" vs. circular report pins; legend swatch now matches)
- [x] Preserve evacuation center information such as:
  - [x] Name
  - [x] Address/location
  - [x] Coordinates
  - [x] Capacity, if available
  - [x] Contact information, if available
  - [x] Verification status

  *(the dataset and `EvacuationCenterResource` type are unchanged; hidden centers keep every field)*

- [x] Preserve the existing `Needs Verification` concept where applicable. (only the marker colour changed; labels, badges and notes untouched — a unit test asserts every nearby center is still `needs_verification` and must be updated, not deleted, when the first verified record lands)
- [x] Avoid presenting unverified evacuation-center information as confirmed.
- [x] Ensure evacuation center filtering/search still works. (filters apply on top of the nearby or show-all set; verified in the browser)

#### Important distinction

The system should follow this principle:

> **Reports are restricted to Calumpit. Evacuation centers are not.**

This distinction must exist in both the frontend and backend architecture. *(Implemented: `lib/report-api.ts` + `lib/calumpit-boundary.ts` enforce the report polygon; `lib/evacuation-center-scope.ts` defines center visibility independently, and `app/api/map/all/route.ts` applies the two rules side by side.)*

---

## Priority 4 — Evidence Capture & Report Metadata ✅ Done (2026-08-26)

### 6. Allow Users to Capture an Image Directly Inside the Website

**Priority:** 🟠 High — **Status: Implemented and verified.**

Users should be able to capture flood evidence directly through the website rather than being limited to uploading an existing image.

> **Implementation summary:** Capture happens in the page via `getUserMedia`, not by handing off to the OS camera app — the confirmed decision, because the native `capture` attribute is ignored by desktop browsers and puts retake outside the site. New `components/report-camera-capture.tsx` is a modal state machine (`requesting → streaming → capturing → captured → error`) following the dialog conventions of `components/weather-alert-viewer.tsx` — the repo's best a11y reference: `role="dialog"` + `aria-modal`, Escape to close, body scroll lock, initial focus on the shutter, bottom sheet on mobile and a centred card on desktop. Two supporting modules split by testability: `lib/report-image-capture.ts` is DOM-free (sizing maths, file naming, capability detection, error wording) and unit-tested; `lib/report-image-browser.ts` owns the `<canvas>`/`<video>` work and is covered by Playwright. The shutter stays disabled until the video reports real frame dimensions — a resolved stream is not yet a drawable one, and capturing early yields a 0×0 frame (found and fixed during browser testing). **Every** exit path — Use photo, Escape, scrim click, unmount, upload-instead — stops the media tracks; a leaked track leaves the device's camera light on after the user believes they closed it. Frames the user rejects never leave the browser.
>
> The photo section of `components/incident-reports-content.tsx` was reworked: **Take photo** and **Upload photo** as two distinct controls, a **remove** button (previously there was no way to un-attach a photo short of reloading), and working drag-and-drop — the copy had advertised "drop" since before this change while no `onDrop` handler existed. Captures always downscale to 1600 px / JPEG q0.85, and uploads over ~1.5 MB or 1600 px do too; the helper returns the **original file untouched** if anything fails, because a failed optimisation must never cost someone their report. Captures are named `flood-capture-YYYYMMDD-HHMMSS.jpg` — the `.jpg` is load-bearing, since `validateReportImageFile` cross-checks extension against MIME type and would reject a canvas JPEG named otherwise. Server-side image handling is unchanged: a canvas JPEG passes the existing `FF D8 FF` magic-byte check, and the 5 MB / 5.25 MB caps in `parseReportRequestFormData` still apply (Next 16 Route Handlers have no configurable body limit, so that application-level guard remains the only one).
>
> Verified: 9 unit tests (`tests/report-image-capture.test.ts` — aspect-preserving sizing, never upscaling, integer pixels, a generated filename round-tripped through the real `validateReportImageFile`, one message per `DOMException` name, secure-context detection) and 4 Playwright specs (`tests/browser/report-camera-capture.spec.ts` — capture → retake → use → remove, Escape leaving the form untouched, a `NotAllowedError` camera still offering upload, and the file input remaining singular so the existing `report-flows` locator holds). Chromium's synthetic capture device is enabled for every project in `playwright.config.ts`; the denial path is injected with `addInitScript`. Screenshots taken at 1440/390 px.
>
> **Not yet verified:** that the hardware camera indicator actually goes dark on exit — Playwright's fake device cannot show it, so only a real device can confirm the track cleanup. Real-device touch interaction remains the standing gap from P0–P3.

#### Requirements

- [x] Add an option to open the device camera from the report form. (`data-testid="capture-report-image"`, hidden entirely when the browser or context cannot support it)
- [x] Support mobile browsers where camera access is available. (`facingMode: { ideal: "environment" }`, `playsInline`, bottom-sheet layout)
- [x] Allow users to take a photo directly from the browser.
- [x] Allow users to retake the photo. (the stream is deliberately left running, so retake is instant)
- [x] Allow users to accept/use the captured photo.
- [x] Preserve the existing image upload option if already supported. (same single `<input type="file">`, same `choose-report-image` testid)
- [x] Clearly distinguish:
  - [x] Take Photo
  - [x] Upload Photo

- [x] Handle camera permission denial gracefully. (`NotAllowedError`/`SecurityError` → how to re-enable, plus an "Upload photo instead" action)
- [x] Handle unsupported browsers gracefully. (the button never renders outside a secure context or without `mediaDevices`; unknown failures fall back to "This browser can't open the camera")
- [x] Do not make camera access mandatory. (every error message names uploading as the way forward; the camera is an addition to the file picker, never a gate in front of it)
- [x] Compress/resize images when appropriate to control storage and upload size. (1600 px / q0.85 for captures and oversized uploads; small images pass through untouched, as does anything the re-encode would enlarge)
- [x] Validate image type and size on the server. (unchanged `validateReportImageFile` + magic-byte `validateReportImageBuffer`)
- [x] Prevent arbitrary non-image files from being uploaded.
- [x] Provide upload/capture progress where appropriate. ("Optimising photo..." with a spinner while downscaling; "Capturing..." on the shutter; the existing "Uploading report..." on submit)
- [ ] Ensure the feature works on common mobile browsers. *(exercised in desktop Chromium at a 390 px viewport with a synthetic camera; not yet run on real iOS Safari or Android Chrome)*

#### Privacy

- [x] Camera access must require explicit browser permission. (the browser's own prompt; nothing is pre-granted)
- [x] Do not activate the camera automatically without user interaction. (`getUserMedia` is called only from the explicit "Take photo" press, never on mount)
- [x] Do not retain camera data that the user did not submit. (tracks stopped on every exit path, object URLs revoked, rejected frames discarded in the browser)
- [x] Clearly communicate when a captured image will be attached to a report. (modal copy: "It is attached only when you submit the report", and the attached card reads "Captured photo. It uploads when you submit this report.")

> **Privacy improvement not asked for but worth recording:** both the capture and the upload path re-encode through a `<canvas>`, which drops EXIF. An uploaded phone photo therefore no longer carries the camera's embedded GPS coordinates into Cloudinary.

---

### 7. Add Reliable Report Timestamps, Latitude, Longitude, and Time Metadata

**Priority:** 🟠 High — **Status: Implemented and verified.**

Every report should contain reliable location and time information.

> **Implementation summary:** The gap this closes: GPS accuracy was **already being read** in `components/incident-reports-content.tsx` and thrown away inside a toast string — the code even carried a comment explaining that the server had no accuracy value — and nothing recorded whether a pin came from GPS, a map tap, a search result or hand-typed numbers, so a ±5 m fix and a guess were indistinguishable to a responder. New `lib/report-location-metadata.ts` (plain TypeScript, no Prisma, shared by the form, the picker, the API route and the tests) defines the vocabulary `gps | map | search | manual` plus parsing and labelling. Migration `prisma/migrations/20260826_report_capture_metadata/` adds `locationSource` (NOT NULL, default `manual`), `gpsAccuracyMeters` and `photoCapturedAt`, an index, and two `NOT VALID` CHECK constraints — one pinning the vocabulary, one making "accuracy only ever accompanies a positive GPS reading" structural rather than merely enforced in code. Purely additive; all 42 pre-existing reports backfilled to `manual` with a null accuracy, which is the honest reading — their provenance genuinely is unknown.
>
> Accuracy is deliberately bound to `source === "gps"`: only the Geolocation API measures it, so letting any other source carry one would let a hand-typed coordinate render as an instrument reading. Provenance is captured at each of the four entry points — the GPS handler, the picker (which now distinguishes a map tap/drag from a search result and passes it through `onConfirm`), and the manual latitude/longitude inputs, which reset the source to `manual` and clear the accuracy because a GPS fix nudged by hand is no longer a GPS fix. Coordinates are normalised to **6 decimal places (~0.11 m) before** the Calumpit polygon test, so the value that gets validated is the value that gets stored; previously the picker emitted `toFixed(6)` while a GPS fix arrived as a full unrounded double. Far below the 300 m incident-matching radius, so P0 matching is untouched.
>
> Display (`lib/reporting.ts`, `lib/report-ui.ts`, `components/incident-report-modal.tsx`): a new `formatAbsoluteTime` renders `Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila" })` — FloodWatch PH covers one municipality, so report times are read in Philippine time wherever the browser is. `formatRelativeTime` is untouched, so the ~10 components that render it did not churn; instead the report detail shows the absolute stamp as a hint beneath the relative one, a provenance line beside the coordinates ("14.9165, 120.7662 · GPS · ±8 m"), and a "Photo taken ..." badge over the image when a capture time exists. All report rendering is client-only, so no hydration risk was introduced.
>
> **A pre-existing bug was found and fixed first, because it blocked this work:** `app/api/reports/[id]/route.ts` spread `parsedReport.data` — which contained `forceNewIncident`, a submission flag rather than a column — straight into `prisma.floodReport.update`, so **every PATCH raised `PrismaClientValidationError` and returned a generic 500**. There was no PATCH test. `parseReportDetailsFormData` now returns `forceNewIncident` as a sibling of `data`, so `data` holds columns only, and a regression test pins it. The PATCH route additionally leaves capture metadata alone unless the request actually carries a `locationSource`: the edit form omits it, and parsing an absent field yields `manual`, which would have quietly downgraded every GPS report the first time somebody fixed a typo in its description.
>
> Verified: 9 unit tests in `tests/report-location-metadata.test.ts`, 4 in `tests/report-time-format.test.ts` (including a UTC instant that crosses midnight in Manila), plus new cases in `tests/report-api.test.ts` and `tests/validations.test.ts`. Live against the database: a GPS submission stored `gps`/12.4 m with coordinates rounded to 6 dp; a `map` source carrying an accuracy had it dropped; `locationSource=hack-attempt` degraded to `manual` rather than erroring; a 3-day-old `photoCapturedAt` was discarded while an in-window one persisted; and a description-only PATCH returned 200 with GPS provenance intact.
>
> **Not yet verified:** real-device touch interaction (standing gap from P0–P3).

#### Required report metadata

- [x] Report creation timestamp. (`createdAt`, server-generated)
- [x] Report update timestamp. (`updatedAt` via Prisma `@updatedAt`, plus `lastActivityAt`)
- [x] Latitude.
- [x] Longitude.
- [x] User/report author. (`userId` since Priority 1)
- [x] Optional photo timestamp/metadata where appropriate. (`photoCapturedAt`, set only by in-app captures and stored only when an image is actually attached)
- [x] Location accuracy when available from device GPS. (`gpsAccuracyMeters`)

#### Requirements

- [x] Generate the authoritative report creation timestamp on the server. (one `new Date()` per transaction plus database defaults)
- [x] Do not trust a client-provided timestamp as the canonical creation time. (`photoCapturedAt` is the only client-supplied time in the schema; it is descriptive metadata about the image and never substitutes for `createdAt`)
- [x] Store timestamps consistently in UTC. (`TIMESTAMP(3)`; Prisma writes UTC instants)
- [x] Convert/display timestamps according to the user's locale where appropriate. (`en-PH` / `Asia/Manila` — a deliberate fixed zone for a single-municipality system, matching the weather module)
- [x] Store coordinates using an appropriate numeric precision. (normalised to 6 dp before validation and storage)
- [x] Validate latitude range: `-90` to `90`.
- [x] Validate longitude range: `-180` to `180`.
- [x] Validate that coordinates fall within the allowed reporting area. (unchanged `isWithinCalumpit`, now applied to the rounded value)
- [x] Capture GPS coordinates when the user grants location permission.
- [x] Allow map selection when GPS is unavailable.
- [x] Store GPS accuracy when available. (only for `gps`; rejected if non-positive, non-finite or beyond 100 km, and rounded to 0.1 m)
- [x] Clearly identify whether a location came from:
  - [x] GPS
  - [x] Map selection
  - [x] Search/geocoding

  *(a fourth value, `manual`, covers hand-typed coordinates and every pre-migration report)*

- [x] Do not allow users to manipulate authoritative server timestamps. (no request field reaches `createdAt`/`updatedAt`/`lastActivityAt`; an out-of-window `photoCapturedAt` is silently dropped rather than rejected, so a skewed device clock cannot block a submission)
- [x] Ensure existing reports receive appropriate timestamps during migration if necessary. (timestamps were already present; the new columns backfill to `manual`/null)

#### Display

- [x] Show report date/time in report details. (absolute stamp under both "Reported" and "Last activity")
- [x] Show location coordinates where useful. (report detail, at 4 dp, now with the provenance and accuracy beside them)
- [x] Consider displaying approximate location to public users if privacy requirements require it. **Considered and declined**, per the confirmed decision: a flood report marks a flooded street rather than a residence, responders need the precise spot, and the map pin already discloses it. Recorded here rather than silently skipped — revisit if reports ever cover private dwellings.
- [x] Show relative time where useful, e.g. "10 minutes ago." (unchanged `formatRelativeTime`, now paired with the exact time instead of replaced by it)
- [x] Preserve the exact underlying timestamp for administrative purposes. (full ISO timestamps continue to reach the client; only the rendering is humanised)

---

## Priority 5 — Administrative System

### 8. Create an Admin Dashboard

**Priority:** 🟠 High

Create a dedicated administrative interface for the Calumpit system administrator.

The dashboard should become the central operational interface for monitoring flood reports, managing data, and responding to incidents/rescue requests.

---

### 8.1 Admin Authentication & Authorization

- [ ] Create administrator role support.
- [ ] Restrict admin dashboard access to authorized accounts.
- [ ] Protect admin routes on the server.
- [ ] Protect admin API endpoints.
- [ ] Prevent regular users from accessing administrative functions.
- [ ] Log important administrative actions.
- [ ] Provide administrator logout/session handling.
- [ ] Avoid exposing administrative APIs to unauthorized users.

---

### 8.2 Reports Monitoring

- [ ] Create an admin report list/table.
- [ ] Display:
  - [ ] Report ID
  - [ ] Reporter
  - [ ] Location
  - [ ] Date/time
  - [ ] Report status
  - [ ] Incident association
  - [ ] Photo availability
  - [ ] Verification status

- [ ] Add search.
- [ ] Add filtering.
- [ ] Add sorting.
- [ ] Filter by status.
- [ ] Filter by date.
- [ ] Filter by location/barangay where applicable.
- [ ] Filter by incident.
- [ ] Open complete report details.
- [ ] View submitted photos.
- [ ] View report location on the map.
- [ ] Review duplicate/same-location reports.
- [ ] Mark reports as verified/unverified.
- [ ] Mark reports as resolved/closed where appropriate.
- [ ] Preserve an audit trail of administrative changes.

---

### 8.3 Data Management

- [ ] Allow authorized administrators to update evacuation-center information.
- [ ] Allow administrators to correct inaccurate data.
- [ ] Allow administrators to update verification status.
- [ ] Allow administrators to manage relevant flood-related reference data.
- [ ] Prevent destructive deletion when historical preservation is more appropriate.
- [ ] Prefer soft deletion/archive mechanisms for important records.
- [ ] Record who made administrative changes.
- [ ] Record when administrative changes occurred.
- [ ] Consider an audit log for sensitive data changes.

---

### 8.4 Report Response / Action Management

Administrators should be able to respond to incoming reports.

- [ ] Define report/incident statuses.
- [ ] Suggested statuses:
  - [ ] Pending
  - [ ] Under Review
  - [ ] Verified
  - [ ] Responding
  - [ ] Resolved
  - [ ] Rejected
  - [ ] Closed

- [ ] Allow administrators to update status.
- [ ] Allow administrators to add internal notes.
- [ ] Allow administrators to add response/action notes.
- [ ] Preserve status history.
- [ ] Show the latest administrative action in the dashboard.
- [ ] Prevent users from modifying administrator-only information.
- [ ] Ensure status changes are reflected appropriately on the public map.

---

## Priority 6 — Rescue Request System

### 9. Direct Flood/Rescue Reports to the Calumpit System Administrator

**Priority:** 🟠 High

Incoming reports and rescue requests should reach the appropriate Calumpit system administrator instead of functioning only as passive public map data.

#### Requirements

- [ ] Define the difference between:
  - [ ] Flood information report
  - [ ] Rescue request

- [ ] Require authentication for rescue requests.
- [ ] Associate rescue requests with the requesting user.
- [ ] Capture rescue request location.
- [ ] Capture request timestamp.
- [ ] Capture relevant description/details.
- [ ] Allow optional photo evidence when appropriate.
- [ ] Send the request into the admin dashboard.
- [ ] Ensure administrators can immediately identify urgent requests.
- [ ] Add a clear priority/urgency field.
- [ ] Suggested urgency levels:
  - [ ] Normal
  - [ ] Urgent
  - [ ] Emergency

- [ ] Allow administrators to acknowledge the request.
- [ ] Allow administrators to update the request status.
- [ ] Allow administrators to add response notes.
- [ ] Preserve the request history.

#### Suggested rescue statuses

- [ ] Pending
- [ ] Acknowledged
- [ ] Assigned
- [ ] Responding
- [ ] Resolved
- [ ] Cancelled
- [ ] Closed

#### Administrator workflow

The intended flow should be:

`User submits rescue request`
→ `Server validates request`
→ `Request is stored`
→ `Calumpit administrator is notified/receives request`
→ `Administrator acknowledges`
→ `Administrator takes/assigns action`
→ `Status is updated`
→ `Request is resolved/closed`

---

## Priority 7 — Notifications & Operational Feedback

### 10. Administrator Notifications

**Priority:** 🟡 Medium

After the core admin workflow is functional, add mechanisms that help administrators notice new reports and rescue requests.

#### Requirements

- [ ] Determine the most appropriate notification mechanism.
- [ ] Support new report notifications.
- [ ] Support new rescue request notifications.
- [ ] Clearly distinguish urgent/emergency rescue requests.
- [ ] Avoid excessive notification spam.
- [ ] Track whether an administrator has acknowledged a notification.
- [ ] Provide an unread/pending indicator in the admin dashboard.
- [ ] Ensure notifications do not expose unnecessary personal information.

Possible future notification channels:

- [ ] In-app dashboard notifications.
- [ ] Email.
- [ ] Other officially supported Calumpit administrative communication channels.

> Implement in-app notifications first unless there is a confirmed requirement for an external notification channel.

---

## Priority 8 — Map & UX Refinement

### 11. Improve the Map Around the Calumpit-Only Scope

**Priority:** 🟡 Medium

Once geographic restrictions are implemented, update the map experience to make the scope obvious and intuitive.

- [ ] Set Calumpit as the default map viewport.
- [ ] Display the Calumpit reporting boundary.
- [x] Clearly distinguish the reporting area from nearby evacuation-center coverage. *(closed by Priority 3: boundary mask + legend + "Reports: Calumpit only · Shelters: within 25 km" chip)*
- [ ] Keep map interactions usable on mobile.
- [ ] Prevent confusing behavior when users attempt to move outside the supported area.
- [ ] Update location picker behavior.
- [ ] Ensure search results outside the reporting area cannot be submitted as flood reports.
- [x] Preserve the ability to navigate to nearby evacuation centers outside Calumpit. *(closed by Priorities 2–3: the padded map box was sized to keep the nearby centers reachable, and "View on Map" from the list only targets centers inside it)*
- [x] Ensure report markers and evacuation-center markers remain visually distinguishable. *(closed by Priority 3: shape + hue)*
- [ ] Verify clustering behavior after geographic restrictions are introduced.

---

## Priority 9 — Security, Validation & Abuse Prevention

### 12. Strengthen Server-Side Validation

**Priority:** 🟡 Medium

All critical constraints must be enforced on the backend.

- [ ] Validate authenticated user identity.
- [ ] Validate report ownership.
- [ ] Validate admin authorization.
- [ ] Validate coordinates.
- [ ] Validate Calumpit boundary.
- [x] Validate timestamps. *(closed by Priority 4: the only client-supplied time is clamped to a sane window server-side; all authoritative timestamps are server-generated)*
- [x] Validate uploaded files. *(extension/MIME cross-check, magic-byte sniffing, and the 5 MB / 5.25 MB caps — predates P4, re-confirmed against canvas-encoded captures)*
- [ ] Validate report status transitions.
- [ ] Validate rescue request status transitions.
- [ ] Validate incident associations.
- [ ] Prevent unauthorized record modification.
- [ ] Prevent users from submitting reports on behalf of other users.
- [ ] Add rate limiting where appropriate.
- [ ] Protect report/rescue endpoints from spam.
- [ ] Sanitize user-provided text.
- [ ] Review API error handling so sensitive implementation details are not exposed.

---

## Priority 10 — Testing & Quality Assurance

### 13. Add Automated Tests for the New Workflow

**Priority:** 🟡 Medium

At minimum, test the following areas.

#### Authentication

- [ ] User registration.
- [ ] Login.
- [ ] Logout.
- [ ] Protected report creation.
- [ ] Protected rescue requests.
- [ ] Admin authorization.
- [ ] Unauthorized admin access.

#### Geographic validation

- [ ] Valid Calumpit coordinate.
- [ ] Invalid/outside coordinate.
- [ ] Boundary coordinate.
- [ ] Map-selected location.
- [ ] GPS-selected location.
- [ ] API-submitted location.

#### Reporting

- [ ] Create report.
- [ ] Create report with photo.
- [x] Create report using captured image. *(closed by Priority 4: `tests/browser/report-camera-capture.spec.ts` covers capture → retake → use → remove, and a live submission with a captured JPEG stored its `photoCapturedAt`)*
- [ ] Missing required fields.
- [ ] Invalid coordinates.
- [ ] Duplicate/same-location report.
- [ ] Separate incident at same location.
- [ ] Report status updates.

#### Rescue requests

- [ ] Create request.
- [ ] Invalid location.
- [ ] Missing required information.
- [ ] Administrator acknowledgement.
- [ ] Status transitions.
- [ ] Resolution/closure.

#### Admin

- [ ] Report filtering.
- [ ] Report status updates.
- [ ] Data updates.
- [ ] Verification changes.
- [ ] Audit logging.
- [ ] Unauthorized access prevention.

---

# Implementation Order

Coding agents should generally execute the work in this order:

1. ~~**Same-location / incident handling**~~ ✅ Done (2026-08-23)
2. ~~**Authentication and user accounts**~~ ✅ Done (2026-08-26)
3. ~~**Calumpit geographic boundary**~~ ✅ Done (2026-08-26)
4. ~~**Server-side reporting-area validation**~~ ✅ Done (2026-08-26)
5. ~~**Report timestamps and location metadata**~~ ✅ Done (2026-08-26)
6. ~~**Direct camera/image capture**~~ ✅ Done (2026-08-26)
7. **Admin authentication and roles**
8. **Admin dashboard**
9. **Report monitoring and management**
10. **Rescue request workflow**
11. **Administrator response/action workflow**
12. ~~**Nearby evacuation-center visibility**~~ ✅ Done (2026-08-25, pulled forward as Priority 3)
13. **Administrator notifications**
14. **Map/UX refinements**
15. **Security hardening**
16. **Automated testing and regression testing**

---

# Cross-Cutting Development Rules

## Preserve Existing Functionality

- [ ] Do not remove existing flood map functionality unless explicitly required.
- [ ] Do not break existing report-sharing URLs.
- [ ] Do not unnecessarily change existing database records.
- [ ] Preserve existing evacuation-center functionality.
- [ ] Preserve mobile responsiveness.
- [ ] Preserve report photos already stored in the system.
- [ ] Preserve existing clustering behavior unless the new incident model requires changes.

## Database Changes

Before modifying the database:

- [ ] Inspect the current Prisma schema.
- [ ] Inspect existing relations.
- [ ] Inspect existing report records.
- [ ] Determine whether a migration is required.
- [ ] Avoid destructive migrations.
- [ ] Create appropriate indexes.
- [ ] Update seed data where necessary.
- [ ] Verify migration behavior on an existing database.
- [ ] Regenerate Prisma Client after schema changes.

## API Changes

For every new or modified endpoint:

- [ ] Define request schema.
- [ ] Define response schema.
- [ ] Validate all input server-side.
- [ ] Verify authentication requirements.
- [ ] Verify authorization requirements.
- [ ] Handle invalid requests consistently.
- [ ] Avoid leaking sensitive information.
- [ ] Add tests.
- [ ] Update existing callers/components.

## UI Changes

For every new feature:

- [ ] Desktop layout.
- [ ] Mobile layout.
- [ ] Loading states.
- [ ] Empty states.
- [ ] Error states.
- [ ] Success feedback.
- [ ] Permission-denied states.
- [ ] Network failure handling.
- [ ] Accessibility.
- [ ] Consistent FloodWatch PH visual language.

---

# Definition of Done

A feature should not be considered complete until:

- [ ] The database/schema changes are complete.
- [ ] Backend validation is implemented.
- [ ] Authentication/authorization requirements are enforced.
- [ ] Frontend implementation is complete.
- [ ] Mobile behavior has been checked.
- [ ] Error/loading/empty states are handled.
- [ ] Existing functionality has been regression-tested.
- [ ] Relevant automated tests have been added.
- [ ] No client-side-only security assumptions remain.
- [ ] Documentation/comments are updated where necessary.
- [ ] Database migrations have been tested.
- [ ] The implementation does not bypass the Calumpit reporting boundary.
- [ ] Administrative actions are properly authorized and traceable.

---

# Target System Behavior

The intended high-level workflow after these features are implemented is:

```text
PUBLIC USER
    │
    ├── View FloodWatch PH map
    │       ├── Calumpit flood reports
    │       └── Nearby Bulacan evacuation centers
    │
    └── Create Account
            │
            ▼
      AUTHENTICATED USER
            │
            ├── Submit Flood Report
            │       ├── Location
            │       ├── Timestamp
            │       ├── Description
            │       └── Photo / Camera Capture
            │
            └── Submit Rescue Request
                    ├── Location
                    ├── Timestamp
                    ├── Details
                    └── Optional Photo
                            │
                            ▼
                 SERVER VALIDATION
                            │
                            ├── Authenticated?
                            ├── Valid coordinates?
                            ├── Within Calumpit?
                            ├── Existing incident?
                            └── Valid request?
                            │
                            ▼
                 CALUMPIT ADMIN SYSTEM
                            │
                            ├── Monitor Reports
                            ├── Review Incidents
                            ├── Verify Information
                            ├── Manage Evacuation Centers
                            ├── Receive Rescue Requests
                            ├── Respond / Assign Action
                            └── Update Status
                            │
                            ▼
                    RESOLVED / CLOSED
```

## Final Priority Principle

The implementation should prioritize **data correctness, authentication, geographic enforcement, and operational reliability** before cosmetic improvements.

The most important architectural rule is:

> **FloodWatch PH is a Calumpit-focused reporting and response system. Flood reports and rescue requests must be restricted to Calumpit, while nearby evacuation centers in Bulacan may remain visible to provide useful evacuation information.**

Any implementation that only hides unsupported locations in the frontend but still allows invalid reports through the API should be considered **incomplete**.
