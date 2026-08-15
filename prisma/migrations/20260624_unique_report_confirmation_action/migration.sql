-- Remove duplicate browser actions before enforcing uniqueness.
WITH "rankedConfirmations" AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "reportId", "confirmationType", "ipHash"
            ORDER BY "createdAt" ASC, "id" ASC
        ) AS "duplicateRank"
    FROM "ReportConfirmation"
    WHERE "ipHash" IS NOT NULL
)
DELETE FROM "ReportConfirmation"
USING "rankedConfirmations"
WHERE "ReportConfirmation"."id" = "rankedConfirmations"."id"
  AND "rankedConfirmations"."duplicateRank" > 1;

-- Reconcile cached counters with the remaining action records.
UPDATE "FloodReport"
SET
    "confirmationCount" = (
        SELECT COUNT(*)::INTEGER
        FROM "ReportConfirmation"
        WHERE "ReportConfirmation"."reportId" = "FloodReport"."id"
          AND "ReportConfirmation"."confirmationType" = 'confirmed'
    ),
    "resolvedCount" = (
        SELECT COUNT(*)::INTEGER
        FROM "ReportConfirmation"
        WHERE "ReportConfirmation"."reportId" = "FloodReport"."id"
          AND "ReportConfirmation"."confirmationType" = 'resolved'
    );

-- Prevent concurrent requests from recording the same browser action twice.
CREATE UNIQUE INDEX "ReportConfirmation_reportId_confirmationType_ipHash_key"
ON "ReportConfirmation"("reportId", "confirmationType", "ipHash");
