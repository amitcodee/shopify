-- AlterTable
ALTER TABLE "User" ADD COLUMN     "totpEnabledAt" TIMESTAMP(3),
ADD COLUMN     "totpLastStep" INTEGER,
ADD COLUMN     "totpSecretEnc" TEXT;

-- CreateIndex
CREATE INDEX "Cart_expiresAt_idx" ON "Cart"("expiresAt");

-- CreateIndex
CREATE INDEX "CartLine_variantId_idx" ON "CartLine"("variantId");

-- CreateIndex
CREATE INDEX "Order_storeId_customerId_idx" ON "Order"("storeId", "customerId");

-- CreateIndex
CREATE INDEX "Order_storeId_paidAt_idx" ON "Order"("storeId", "paidAt");

-- CreateIndex
CREATE INDEX "Product_tags_idx" ON "Product" USING GIN ("tags");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
