-- Gift cards: store credit redeemed at checkout, with an append-only balance history.

-- CreateEnum
CREATE TYPE "GiftCardTransactionKind" AS ENUM ('ISSUED', 'REDEEMED', 'RESTORED', 'REFUNDED', 'ADJUSTED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "giftCardAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "giftCardId" UUID;

-- CreateTable
CREATE TABLE "GiftCard" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "codeHash" TEXT NOT NULL,
    "lastCharacters" CHAR(4) NOT NULL,
    "initialValue" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "customerId" UUID,
    "note" TEXT,
    "expiresAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GiftCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftCardTransaction" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "giftCardId" UUID NOT NULL,
    "kind" "GiftCardTransactionKind" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "orderId" UUID,
    "actorUserId" UUID,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiftCardTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GiftCard_storeId_createdAt_idx" ON "GiftCard"("storeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GiftCard_storeId_id_key" ON "GiftCard"("storeId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "GiftCard_storeId_codeHash_key" ON "GiftCard"("storeId", "codeHash");

-- CreateIndex
CREATE INDEX "GiftCardTransaction_giftCardId_createdAt_idx" ON "GiftCardTransaction"("giftCardId", "createdAt");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_storeId_giftCardId_fkey" FOREIGN KEY ("storeId", "giftCardId") REFERENCES "GiftCard"("storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCard" ADD CONSTRAINT "GiftCard_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCard" ADD CONSTRAINT "GiftCard_storeId_customerId_fkey" FOREIGN KEY ("storeId", "customerId") REFERENCES "Customer"("storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCardTransaction" ADD CONSTRAINT "GiftCardTransaction_storeId_giftCardId_fkey" FOREIGN KEY ("storeId", "giftCardId") REFERENCES "GiftCard"("storeId", "id") ON DELETE CASCADE ON UPDATE CASCADE;


SELECT app_enable_tenant_rls('"GiftCard"');
SELECT app_enable_tenant_rls('"GiftCardTransaction"');
REVOKE UPDATE, DELETE ON "GiftCardTransaction" FROM shop_app;
ALTER TABLE "GiftCard" ADD CONSTRAINT "GiftCard_balance_range"
  CHECK ("initialValue" > 0 AND "balance" >= 0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_giftCardAmount_range"
  CHECK ("giftCardAmount" >= 0 AND "giftCardAmount" <= "total");
