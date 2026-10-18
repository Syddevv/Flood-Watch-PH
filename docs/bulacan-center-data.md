# Bulacan center data rollout

The public center list and map read `EvacuationCenter` rows, not the old static
reference array. Public rows require a Bulacan locality and polygon point, an
official source URL, a source check date, `verified` identity, and no archive
flag. A source check older than 90 days is labelled outdated. Operational
availability is unknown unless an administrator explicitly confirmed it within
24 hours. Estimated capacity is planning data; there is no occupancy count.

The existing configured database has three Metro Manila legacy/demo rows and
no publishable Bulacan center rows as of 18 October 2026. The additive migration
preserves them, normalizes legacy status strings, and archives active
out-of-province rows. It does not import unsourced static Bulacan references.
The administrator may restore archived rows for historical review. Never run
the old center seed as a backfill; the center seed block has been removed.

Deploy sequence: apply `prisma migrate deploy`, deploy this code, then add
officially sourced center records through the admin form. Confirm a newly
verified record appears on `/api/evacuation-centers`, the public list, and map;
then archive it and confirm all public views remove it after refresh. The
public list should honestly show no published records until source collection
and administrator review occur. Rollback: deploy the previous application
version first; the added nullable availability timestamp can remain harmlessly
until a separate reviewed rollback. Do not drop it after administrators begin
recording confirmations without preserving those timestamps.
