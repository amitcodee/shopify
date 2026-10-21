-- Gift cards sold as products.

-- AlterTable
ALTER TABLE "GiftCard" ADD COLUMN     "sourceOrderId" UUID;

-- AlterTable
ALTER TABLE "OrderLine" ADD COLUMN     "isGiftCard" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "isGiftCard" BOOLEAN NOT NULL DEFAULT false;

