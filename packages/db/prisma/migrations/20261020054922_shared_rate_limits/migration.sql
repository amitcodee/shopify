-- Shared rate limiting (docs/security-review.md, follow-ups).

-- Redundant since the review fixes: the ("storeId", hostname) unique index covers storeId lookups.
DROP INDEX "Domain_storeId_idx";

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "hits" INTEGER NOT NULL,
    "windowEndsAt" TIMESTAMP(3) NOT NULL,
    "blockedUntil" TIMESTAMP(3),

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "RateLimitBucket_windowEndsAt_idx" ON "RateLimitBucket"("windowEndsAt");

-- Counters are disposable: skip WAL for speed (contents are lost after a crash, which only resets limits).
ALTER TABLE "RateLimitBucket" SET UNLOGGED;
