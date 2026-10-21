-- Abandoned checkout recovery emails.

-- CreateEnum
CREATE TYPE "RecoveryStatus" AS ENUM ('SENT', 'SKIPPED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "recoveryEmailSentAt" TIMESTAMP(3),
ADD COLUMN     "recoveryStatus" "RecoveryStatus";

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "abandonedCheckoutDelayHours" INTEGER DEFAULT 10;

-- CreateIndex
CREATE INDEX "Order_status_recoveryStatus_createdAt_idx" ON "Order"("status", "recoveryStatus", "createdAt");

-- Checkouts that expired before this release are not emailed retroactively.
UPDATE "Order" SET "recoveryStatus" = 'SKIPPED' WHERE "status" = 'CANCELLED';

ALTER TABLE "Store" ADD CONSTRAINT "Store_abandonedCheckoutDelayHours_range"
  CHECK ("abandonedCheckoutDelayHours" IS NULL OR "abandonedCheckoutDelayHours" BETWEEN 1 AND 72);
