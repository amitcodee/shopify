-- Review request emails (ADR 0016): sent at most once per order.

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "reviewRequestSentAt" TIMESTAMP(3);

