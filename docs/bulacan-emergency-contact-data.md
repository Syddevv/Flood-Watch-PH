# Bulacan emergency-contact rollout

The public hotline page, dashboard panels, and rescue aside read the bounded
`/api/emergency-contacts` endpoint. A row is public only when it is unarchived,
verified, has an official HTTPS source URL and source-check date, and is either
marked national or belongs to Bulacan. The public response omits import keys
and internal verification fields. Sources older than 90 days remain visible but
are labelled as needing rechecking. A matching normalized phone number is
displayed only once. National contacts are a separate fallback group.

The previous static contact arrays included unsourced and Metro Manila/demo
numbers. They are no longer used by public views. The five legacy seeded
national database rows remain stored but unpublished under the new default
`needs_verification` state. The seed no longer deletes or recreates contact
rows. No existing contact is deleted by the migration or importer.

The controlled importer contains four source-checked entries: Bulacan PDRRMO
landline and two mobile numbers from
<https://pdrrmo.bulacan.gov.ph/contact-us/>, plus national 911 from
<https://ehotlines.e.gov.ph/>. Their recorded check date is 18 October 2026.
It skips already imported keys, backfills only a single matching unverified,
unsourced legacy row for the same agency, and asks for manual reconciliation
on ambiguous numbers. It does not invent municipal numbers; a municipality
with no verified local contact shows an explicit gap.

Deployment order: apply the additive Prisma migrations, deploy the code, run
`npx tsx scripts/import-verified-emergency-contacts.ts` to review the dry run,
then run the same command with `--apply` only after checking the target
database and proposed actions. Re-run safely after partial failure. Check
`/api/emergency-contacts` and the hotline page after import. Do not run the
old seed as a contact refresh.

Rollback: deploy the previous application version first. The added nullable
provenance fields and verification defaults can remain without removing rows.
Do not drop them after verified contacts have been entered unless their data
is exported and a separate rollback is reviewed. Production migration and
import have not been run from this workspace.
