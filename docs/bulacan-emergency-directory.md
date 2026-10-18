# Bulacan emergency directory rollout

The source file is `data/bulacan-emergency-directory.json`. It is a partial official-publication directory, **not** a live shelter activation or call-tested hotline feed. The current file contains 43 facilities, 81 contact records, 97 phone entries, and 24 source records. All 24 Bulacan LGUs have coverage entries, but only 14 have a named facility in the retrieved sources. Only 10 facilities have source-published coordinates. A zero count does not establish that an LGU has no evacuation centers.

## Apply to a database

Use the intended PostgreSQL database and take a backup first. Set `DIRECT_URL` to its direct connection string (or use `DATABASE_URL` if it is a direct connection), and confirm the target database before running any command. Do not use a production URL for a test import.

```powershell
npx prisma migrate deploy
npx tsx scripts/import-bulacan-emergency-directory.ts
npx tsx scripts/import-bulacan-emergency-directory.ts --apply
npx tsx scripts/import-bulacan-emergency-directory.ts
```

The first importer run is a read-only dry run and prints proposed create/update counts plus potential duplicate IDs. Review those matches before `--apply`. The last dry run should propose zero creations; existing keyed rows may still be listed for source refresh. The importer runs changes in a transaction and keys records by the dataset IDs. It does not delete old or admin-created rows. Reimports refresh source snapshots; once an administrator has edited a record, display/operational fields are kept. An administrator can review duplicate notes, correct or archive records, and add evidence through the protected admin screens. Source research dates are separate from operational confirmation dates.

Deploy the application code and migration together, then run the import against the deployed database and refresh the public pages. The public UI reads the database; the JSON file is not a runtime fallback. Without the migration and import, the new records will not appear. Deployment secrets stay server-side.

## Rollback and limitations

To undo an import, back up or export any administrator changes first, then remove only rows bearing the directory's external keys (`EvacuationCenter.externalKey` and `EmergencyContact.sourceKey`). Do not delete unkeyed administrator-created rows. The migration is additive; leave its nullable columns in place during an application rollback. A later schema rollback should occur only after a backup and compatibility review, since dropping columns destroys source snapshots and corrections.

Research dates do not prove present availability. Historical/planned capacity is not available space. Facilities without coordinates have no map marker or directions. Undated/legacy numbers need reconfirmation, and a `tel_uri` exists only when supplied by the source file. The dataset's `excluded_or_unresolved` entries are retained in the file for research but are never imported into public records. The current integration tests require a separately configured `TEST_DATABASE_URL`; do not point them at production.
