# Onsite flood reporting

## Implemented policy

New public flood reports use policy `u2-provisional-2026-10-17`. The values are centralized in `lib/onsite-report-policy.ts` and are provisional until field trials validate them:

- GPS fix age: at most 2 minutes
- Claimed GPS accuracy: 100 m or better
- Camera capture age: at most 5 minutes
- Reported point distance from the GPS fix: at most 150 m plus the claimed GPS uncertainty
- Future device-clock tolerance: 30 seconds

The server requires image bytes, a capture timestamp, GPS coordinates, GPS timestamp, and GPS accuracy. It checks both points against the U0 Bulacan polygon, rejects a GPS accuracy circle that reaches a province edge or hole, and rejects a report pin beyond the distance allowance. A rejected border case directs the resident to administrator review; the separate admin-create route is the controlled human path and is recorded as official/admin provenance.

## Evidence and privacy

Passing the policy means only that the submitted values and image met these checks. Browser camera frames, device timestamps, and browser geolocation can be spoofed. The UI therefore says “onsite submission checks met,” never “physical presence verified,” and keeps admin verification separate.

Precise GPS evidence is stored for authorized operational review but removed from public report DTOs. Public responses expose only the report pin, its original selection provenance, and the boolean onsite-eligibility result. Existing reports have no policy version or eligibility timestamp and remain readable without an onsite label.

## Capture challenge decision

U2 does not add a server capture challenge. A short-lived, session-bound, single-use challenge could reduce simple replay, but it cannot attest camera origin, genuine GPS, or physical presence. Adding a challenge table, issuance endpoint, atomic consumption, expiry cleanup, and recovery states is not justified until abuse evidence shows replay is a material problem.

## Mutation policy

- `POST /api/reports`: requires the full current onsite policy.
- `PATCH /api/reports/[id]`: allows owner text/category/severity/location-label corrections only. Coordinate and photo changes are rejected; a different place or new image requires a new onsite report.
- `POST /api/reports/[id]/updates`: allows owner text and severity updates only. Images are rejected.
- `DELETE /api/reports/[id]`: remains an owner deletion and needs no new evidence.
- `POST /api/admin/reports`: remains a protected human-review/admin path, uses `locationSource: "admin"`, and is not labelled onsite eligible.
- Rescue intake remains separate: its photos are optional and it may retain upload/manual-location recovery paths.

## Release follow-up

Before treating the provisional thresholds as operational policy, run field trials across representative Bulacan devices, dense areas, rural areas, poor-connectivity conditions, and border localities. Record false-rejection rates and deliberately choose a new version whenever a threshold changes. Deploy `prisma/migrations/20261017_onsite_report_evidence/migration.sql` before releasing the new public form.
