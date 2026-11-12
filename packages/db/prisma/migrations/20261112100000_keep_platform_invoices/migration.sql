-- DropForeignKey
ALTER TABLE "PlatformInvoice" DROP CONSTRAINT "PlatformInvoice_subscriptionId_fkey";

-- AlterTable
ALTER TABLE "PlatformInvoice" ALTER COLUMN "subscriptionId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "PlatformInvoice" ADD CONSTRAINT "PlatformInvoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

