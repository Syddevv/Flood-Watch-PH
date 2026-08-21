# FloodWatch PH — Additional Features TODO

> **Purpose:** This document serves as the implementation roadmap for coding agents working on the next phase of FloodWatch PH.
> **Priority order:** Tasks are arranged from **highest priority to lowest priority**.
> **General rule:** Preserve existing functionality unless a task explicitly requires a behavior change. Before implementing a feature, inspect the existing architecture, database schema, API routes, components, and current reporting workflow.

---

## Priority 0 — Critical Architecture & Data Integrity

### 1. Decide and Implement Handling for Reports at the Same Location

**Priority:** 🔴 Critical

The reporting system must have a clear, server-enforced strategy for multiple flood reports referring to the same physical location.

#### Requirements

- [ ] Inspect the current report creation and matching logic.
- [ ] Determine how reports should be grouped when they represent the same flooding incident.
- [ ] Define what constitutes a "same location" report.
- [ ] Use a configurable geographic radius rather than requiring exact latitude/longitude equality.
- [ ] Consider report recency/time when determining whether reports belong to the same incident.
- [ ] Prevent duplicate reports from unnecessarily creating separate incidents.
- [ ] Still allow users to submit a new report when the situation has materially changed.
- [ ] Preserve individual user reports as historical records.
- [ ] Do not silently delete or overwrite existing reports.
- [ ] Make the matching logic server-enforced so clients cannot bypass it.
- [ ] Ensure concurrent report submissions cannot create inconsistent incident relationships.
- [ ] Add appropriate database indexes for geographic/time-based lookup where practical.
- [ ] Update the UI to clearly explain when a report appears to correspond to an existing incident.
- [ ] Allow users to contribute information to an existing incident when appropriate.
- [ ] Allow an explicitly separate report/incident when the user indicates that it is a different situation.
- [ ] Ensure the final behavior works correctly on desktop and mobile.

#### Data integrity

- [ ] Define the relationship between `Report` and `Incident` if an incident abstraction is used.
- [ ] Ensure reports remain individually attributable to their submitting users.
- [ ] Store creation/update timestamps consistently.
- [ ] Ensure incident status can be updated without destroying the original report data.
- [ ] Add migrations only after validating the existing production/development schema.
- [ ] Update Prisma models and generated client where necessary.
- [ ] Add tests for duplicate/same-location scenarios.

#### Test cases

- [ ] Two reports within the matching radius and time window.
- [ ] Two reports at exactly the same coordinates.
- [ ] Two reports slightly outside the matching radius.
- [ ] Two reports at the same location but far apart in time.
- [ ] Multiple users reporting simultaneously.
- [ ] Same user submitting multiple reports.
- [ ] Existing incident with several contributing reports.
- [ ] User intentionally creating a separate incident.
- [ ] Reports near the boundary of Calumpit.

---

## Priority 1 — Authentication & User Accountability

### 2. Require Users to Create an Account

**Priority:** 🔴 Critical

FloodWatch PH should move from anonymous reporting toward authenticated reporting.

#### Requirements

- [ ] Inspect the existing authentication architecture before introducing a new system.
- [ ] Require authentication before submitting a flood report.
- [ ] Require authentication before submitting a rescue request.
- [ ] Preserve public access to viewing the flood map unless requirements state otherwise.
- [ ] Clearly distinguish public map access from authenticated actions.
- [ ] Associate every report with the authenticated user.
- [ ] Associate every rescue request with the authenticated user.
- [ ] Prevent spoofing another user's identity.
- [ ] Validate authorization on the server/API layer.
- [ ] Do not rely solely on client-side route protection.
- [ ] Add appropriate login/register/logout flows.
- [ ] Add session handling and expiration.
- [ ] Handle unauthenticated users gracefully when they attempt restricted actions.
- [ ] Preserve existing report links and public report viewing where possible.
- [ ] Update the UI to communicate which actions require an account.
- [ ] Ensure mobile authentication flows work correctly.

#### User data

- [ ] Define the minimum user information required.
- [ ] Avoid collecting unnecessary personal information.
- [ ] Store passwords securely using the chosen authentication solution.
- [ ] Never expose password hashes or sensitive authentication data through API responses.
- [ ] Add role support for regular users and administrators.
- [ ] Add database constraints/indexes where appropriate.

#### Authorization

- [ ] Regular users can manage only actions they are authorized to perform.
- [ ] Administrators can access administrative functionality.
- [ ] Verify authorization on every protected API endpoint.
- [ ] Do not rely on hidden UI elements as an authorization mechanism.

---

## Priority 2 — Calumpit Geographic Scope

### 3. Restrict the Main Map to Calumpit, Bulacan

**Priority:** 🔴 High

FloodWatch PH should operate primarily within the defined Calumpit, Bulacan geographic area.

#### Requirements

- [ ] Define the official Calumpit geographic boundary.
- [ ] Determine whether the boundary should use:
  - [ ] Bounding box, or
  - [ ] Polygon/geographic boundary.

- [ ] Prefer an actual geographic boundary/polygon when feasible.
- [ ] Update the map's initial viewport to Calumpit.
- [ ] Prevent normal map navigation from making the application behave as though it supports arbitrary locations.
- [ ] Ensure map markers primarily represent locations within the supported reporting area.
- [ ] Clearly communicate the supported geographic coverage in the UI.
- [ ] Avoid misleading users into believing the system supports all of Bulacan or the entire Philippines.

#### Backend enforcement

- [ ] Validate report coordinates against the Calumpit boundary on the server.
- [ ] Reject report submissions outside the supported reporting area.
- [ ] Do not rely only on map UI restrictions.
- [ ] Validate manually submitted coordinates as well.
- [ ] Validate coordinates received through APIs.
- [ ] Add tests for locations inside and outside the boundary.

---

### 4. Restrict Reporting Scope to Calumpit, Bulacan

**Priority:** 🔴 High

Only locations within the supported Calumpit reporting area should accept flood reports.

#### Requirements

- [ ] Validate latitude/longitude during report creation.
- [ ] Reject coordinates outside the Calumpit reporting boundary.
- [ ] Display a clear error when a user attempts to report outside the area.
- [ ] Ensure map picker cannot accidentally submit an unsupported location.
- [ ] Ensure search-selected locations are validated.
- [ ] Ensure GPS-selected locations are validated.
- [ ] Ensure manually provided coordinates are validated.
- [ ] Ensure existing report APIs cannot bypass the geographic restriction.
- [ ] Add automated tests for boundary cases.

#### UX

- [ ] Show the supported reporting area visually on the map.
- [ ] Provide clear feedback when the selected location is outside Calumpit.
- [ ] Avoid allowing users to complete the report form only to discover at the final submission step that the location is invalid.
- [ ] Handle GPS accuracy/uncertainty gracefully near the boundary.

---

## Priority 3 — Evacuation Center Coverage

### 5. Keep Nearby Bulacan Evacuation Centers Visible

**Priority:** 🟠 High

Although reporting should be restricted to Calumpit, nearby evacuation centers outside Calumpit should remain visible when they are relevant to people in the area.

#### Requirements

- [ ] Separate the **reporting boundary** from the **evacuation center visibility boundary**.
- [ ] Do not apply the Calumpit reporting restriction to evacuation center data.
- [ ] Keep relevant nearby Bulacan evacuation centers visible.
- [ ] Define what "nearby" means.
- [ ] Prefer a configurable distance/radius around Calumpit.
- [ ] Ensure evacuation centers just outside Calumpit are not unnecessarily hidden.
- [ ] Clearly distinguish evacuation center markers from flood report markers.
- [ ] Preserve evacuation center information such as:
  - [ ] Name
  - [ ] Address/location
  - [ ] Coordinates
  - [ ] Capacity, if available
  - [ ] Contact information, if available
  - [ ] Verification status

- [ ] Preserve the existing `Needs Verification` concept where applicable.
- [ ] Avoid presenting unverified evacuation-center information as confirmed.
- [ ] Ensure evacuation center filtering/search still works.

#### Important distinction

The system should follow this principle:

> **Reports are restricted to Calumpit. Evacuation centers are not.**

This distinction must exist in both the frontend and backend architecture.

---

## Priority 4 — Evidence Capture & Report Metadata

### 6. Allow Users to Capture an Image Directly Inside the Website

**Priority:** 🟠 High

Users should be able to capture flood evidence directly through the website rather than being limited to uploading an existing image.

#### Requirements

- [ ] Add an option to open the device camera from the report form.
- [ ] Support mobile browsers where camera access is available.
- [ ] Allow users to take a photo directly from the browser.
- [ ] Allow users to retake the photo.
- [ ] Allow users to accept/use the captured photo.
- [ ] Preserve the existing image upload option if already supported.
- [ ] Clearly distinguish:
  - [ ] Take Photo
  - [ ] Upload Photo

- [ ] Handle camera permission denial gracefully.
- [ ] Handle unsupported browsers gracefully.
- [ ] Do not make camera access mandatory.
- [ ] Compress/resize images when appropriate to control storage and upload size.
- [ ] Validate image type and size on the server.
- [ ] Prevent arbitrary non-image files from being uploaded.
- [ ] Provide upload/capture progress where appropriate.
- [ ] Ensure the feature works on common mobile browsers.

#### Privacy

- [ ] Camera access must require explicit browser permission.
- [ ] Do not activate the camera automatically without user interaction.
- [ ] Do not retain camera data that the user did not submit.
- [ ] Clearly communicate when a captured image will be attached to a report.

---

### 7. Add Reliable Report Timestamps, Latitude, Longitude, and Time Metadata

**Priority:** 🟠 High

Every report should contain reliable location and time information.

#### Required report metadata

- [ ] Report creation timestamp.
- [ ] Report update timestamp.
- [ ] Latitude.
- [ ] Longitude.
- [ ] User/report author.
- [ ] Optional photo timestamp/metadata where appropriate.
- [ ] Location accuracy when available from device GPS.

#### Requirements

- [ ] Generate the authoritative report creation timestamp on the server.
- [ ] Do not trust a client-provided timestamp as the canonical creation time.
- [ ] Store timestamps consistently in UTC.
- [ ] Convert/display timestamps according to the user's locale where appropriate.
- [ ] Store coordinates using an appropriate numeric precision.
- [ ] Validate latitude range: `-90` to `90`.
- [ ] Validate longitude range: `-180` to `180`.
- [ ] Validate that coordinates fall within the allowed reporting area.
- [ ] Capture GPS coordinates when the user grants location permission.
- [ ] Allow map selection when GPS is unavailable.
- [ ] Store GPS accuracy when available.
- [ ] Clearly identify whether a location came from:
  - [ ] GPS
  - [ ] Map selection
  - [ ] Search/geocoding

- [ ] Do not allow users to manipulate authoritative server timestamps.
- [ ] Ensure existing reports receive appropriate timestamps during migration if necessary.

#### Display

- [ ] Show report date/time in report details.
- [ ] Show location coordinates where useful.
- [ ] Consider displaying approximate location to public users if privacy requirements require it.
- [ ] Show relative time where useful, e.g. "10 minutes ago."
- [ ] Preserve the exact underlying timestamp for administrative purposes.

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
- [ ] Clearly distinguish the reporting area from nearby evacuation-center coverage.
- [ ] Keep map interactions usable on mobile.
- [ ] Prevent confusing behavior when users attempt to move outside the supported area.
- [ ] Update location picker behavior.
- [ ] Ensure search results outside the reporting area cannot be submitted as flood reports.
- [ ] Preserve the ability to navigate to nearby evacuation centers outside Calumpit.
- [ ] Ensure report markers and evacuation-center markers remain visually distinguishable.
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
- [ ] Validate timestamps.
- [ ] Validate uploaded files.
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
- [ ] Create report using captured image.
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

1. **Same-location / incident handling**
2. **Authentication and user accounts**
3. **Calumpit geographic boundary**
4. **Server-side reporting-area validation**
5. **Report timestamps and location metadata**
6. **Direct camera/image capture**
7. **Admin authentication and roles**
8. **Admin dashboard**
9. **Report monitoring and management**
10. **Rescue request workflow**
11. **Administrator response/action workflow**
12. **Nearby evacuation-center visibility**
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
