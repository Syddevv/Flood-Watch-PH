# FloodWatch PH Issue Backlog

This list tracks confirmed remaining issues after the critical and first high-priority fixes.

## Completed

- [x] Enforce report ownership for edits and deletes.
- [x] Add signed anonymous report sessions.
- [x] Prevent duplicate confirmation actions.
- [x] Add database-backed API rate limiting.
- [x] Handle malformed multipart report requests.
- [x] Generate Prisma before typechecking and deployment checks.
- [x] Add unit and API integration-test harnesses.
- [x] Add GitHub Actions quality checks.
- [x] Harden report image validation and remove Base64 database fallback.

## High Priority

- [x] Make confirmation and resolution undo operations atomic so concurrent requests cannot corrupt denormalized counters.
- [x] Stop trusting client-controlled proxy headers for rate-limit identity; use a deployment-provided client address or a trusted proxy boundary.
- [x] Replace full-table report/map scans and read-time lifecycle writes with bounded database queries and background reconciliation.
- [x] Add indexes for report status, severity, category, source type, timestamps, and geographic lookups.
- [x] Return an explicit database-unavailable response instead of a successful empty report list during database outages.

## Medium Priority

- [x] Add retention cleanup for expired `RequestRateLimit` rows.
- [x] Decouple read-only weather and geocoding availability from the database-backed rate limiter, or define an explicit fail-closed policy per endpoint.
- [ ] Configure a dedicated `TEST_DATABASE_URL` in CI and enable the integration job.
- [ ] Expand integration coverage to report updates, resolve/undo, malformed uploads, rate limits, and concurrent actions.
- [ ] Remove the build-time dependency on Google Fonts or vendor the fonts locally.
- [ ] Decide whether archived reports should be publicly retrievable with `includeArchived=true`; enforce the chosen policy consistently.
- [ ] Bound search, location, and cache-key input lengths before querying providers or the database.
- [ ] Return stable generic weather-provider errors instead of forwarding exception messages to clients.
- [ ] Add database-level constraints or enums for report severity, status, source type, and confirmation type.
- [ ] Add global throttling and caching that comply with Nominatim usage limits.

## Lower Priority

- [ ] Add rate limiting or internal access controls to the database health endpoint.
- [ ] Add structured error monitoring and request correlation IDs for production diagnosis.
- [ ] Add browser-level coverage for report submission, ownership UI, confirmation undo, and image-upload failure states.
- [ ] Review public reporter-name handling and add a clear privacy policy for user-supplied identifying information.
