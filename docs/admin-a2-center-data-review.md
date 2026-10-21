# A2 evacuation-center data review

Checked 2026-10-19. This review describes the repository dataset and code. It is not a live opening or occupancy check.

## Source and static-reference audit

`npx tsx scripts/audit-evacuation-center-references.ts` validates the sourced directory and compares it with `data/evacuation-centers.ts`. The directory has 43 sourced center records across 14 of Bulacan's 24 localities. Ten localities have no named sourced center in this starter dataset. The old static file has 35 unverified references, including 22 outside the Bulacan polygon. One Malolos sports-convention reference resembles a sourced center by name but differs in location text; it requires human duplicate review. None of the static references is promoted to verified status or imported automatically.

The directory's source IDs, URLs, publication dates, and research dates are in `data/bulacan-emergency-directory.json`. Examples of primary sources are the [City of Malolos DRRM Plan 2022–2026](https://maloloscity.gov.ph/wp-content/uploads/2023/05/City-of-Malolos-DRRM-Plan-2022-2026.pdf) and the [Provincial Government of Bulacan's center-management notice](https://bulacan.gov.ph/bulacan-beefs-up-its-evacuation-center-management/). A publication naming a site does not prove it is open now, field surveyed, or able to accept a stated number of people.

## Import and review

After applying the additive locality migration to a disposable or reviewed target database, run `npx tsx scripts/import-bulacan-emergency-directory.ts` for a read-only database dry run. It reports source-key matches, exact name-and-location matches, ambiguous names skipped for review, and legacy demo/out-of-province rows eligible for archival. `--apply` executes the reviewed plan in one transaction; it does not delete rows. Existing admin edits and live status fields are preserved. A matched source is stored as a separate snapshot with source URL and research date. `lastVerifiedAt` is not invented from a publication research date.

The importer was not run against the configured database in this phase. The configured connection is remote, and its environment is not identified as disposable. No migration or import has been applied by this work.

## Capacity and coverage

`estimatedCapacity` and `capacityFamilies` are historical/planning figures only. Public views label them as such. Current occupancy and available spaces are unavailable: the admin form and API reject new occupancy entries, and overview/analytics display no shelter-occupancy total. An operator-confirmed occupancy workflow would need a separate source, timestamp, history, permissions, and staleness policy.

The ten localities without sourced centers remain visible as data gaps in the audit output. Adding them requires official LGU/PDRRMO/MDRRMO/CDRRMO evidence and duplicate/location review; a guessed center or coordinate must not fill the gap.
