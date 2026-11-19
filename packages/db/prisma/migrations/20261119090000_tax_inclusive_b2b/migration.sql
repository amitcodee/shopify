-- AlterTable
ALTER TABLE "DraftOrder" ADD COLUMN     "taxesIncluded" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "buyerGstin" TEXT,
ADD COLUMN     "buyerLegalName" TEXT,
ADD COLUMN     "taxesIncluded" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "pricesIncludeTax" BOOLEAN NOT NULL DEFAULT false;

