ALTER TABLE "FloodReport"
ADD COLUMN "ownerSessionHash" TEXT;

CREATE INDEX "FloodReport_ownerSessionHash_idx"
ON "FloodReport"("ownerSessionHash");

ALTER TABLE "ReportUpdate"
ADD COLUMN "imageUrl" TEXT,
ADD COLUMN "severity" TEXT,
ADD COLUMN "status" TEXT;
