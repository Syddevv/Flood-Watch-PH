# Rescue Request and Responder Dispatch retirement

The separate Rescue Request and Responder Dispatch workflows are removed from the active Flood Watch application. Citizen intake and tracking, admin intake and queue, responder directory, coordination, assignment, status actions, exports, and their APIs are unavailable. Old page and API URLs return 404. This does not affect flood reports, even when a historical report uses the `Rescue Needed` category. Emergency contact listings that contain rescue agency names are still part of the emergency directory.

## Retained data

`RescueRequest`, `RescueRequestEvent`, `ResponderOrganization`, and `RescueAssignment` Prisma models, their user/report relations, indexes, and existing migrations remain in the schema for compatibility with stored records. Historical admin audit logs and notifications remain in the database. Rescue notifications are excluded from active notification lists and unread counts; they are not deleted or exposed through old detail links. The active application does not read or write rescue records.

Do not run `prisma db push`, drop tables, reset PostgreSQL, or edit applied migrations for this retirement. No migration or configuration change is required to deploy the application-level removal. Existing `PUBLIC_RESCUE_INTAKE_ENABLED` and `ADMIN_RESCUE_ACTIONS_ENABLED` environment values become inert and can be removed from deployment settings during routine configuration maintenance.

## Deployment and rollback

Deploy the application code after normal validation. Verify old rescue pages and APIs return 404, and check flood report, map, weather, centers, emergency contacts, admin analytics, and notifications. A code rollback to the previous revision can restore the feature because the historical schema and data remain; operational use would still require a separate staffing and safety decision.

Physical cleanup is a separate project requiring explicit approval. Before any schema contraction, decide retention requirements, export or archive historical records, take and test a backup, review all relations and indexes, and create a forward-only Prisma migration. Do not delete existing records as part of this application retirement.
