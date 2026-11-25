-- Purchases where the store pays GST under reverse charge.
-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "reverseCharge" BOOLEAN NOT NULL DEFAULT false;

