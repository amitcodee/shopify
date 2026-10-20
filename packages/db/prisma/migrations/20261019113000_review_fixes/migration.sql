-- Security review fixes (docs/security-review.md).

-- Account lockout after repeated failed sign-ins (password or 2FA code).
ALTER TABLE "User" ADD COLUMN "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lockedUntil" TIMESTAMP(3);

-- Domains: unverified claims must not squat a hostname. Unique per store, and globally unique
-- only once verified.
DROP INDEX "Domain_hostname_key";
CREATE UNIQUE INDEX "Domain_storeId_hostname_key" ON "Domain"("storeId", "hostname");
CREATE INDEX "Domain_hostname_idx" ON "Domain"("hostname");
CREATE UNIQUE INDEX "Domain_verified_hostname_key" ON "Domain"("hostname") WHERE "verifiedAt" IS NOT NULL;
