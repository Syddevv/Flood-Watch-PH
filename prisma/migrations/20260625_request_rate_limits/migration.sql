-- CreateTable
CREATE TABLE "RequestRateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequestRateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "RequestRateLimit_expiresAt_idx" ON "RequestRateLimit"("expiresAt");
