-- Premium template purchases (one-time, per store and style). Platform table: no RLS.
-- CreateTable
CREATE TABLE "TemplatePurchase" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "styleId" TEXT NOT NULL,
    "styleLabel" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL,
    "providerOrderId" TEXT,
    "providerPaymentId" TEXT,
    "purchasedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "TemplatePurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TemplatePurchase_providerOrderId_key" ON "TemplatePurchase"("providerOrderId");

-- CreateIndex
CREATE INDEX "TemplatePurchase_storeId_styleId_idx" ON "TemplatePurchase"("storeId", "styleId");


-- A style is paid for at most once per store.
CREATE UNIQUE INDEX "TemplatePurchase_storeId_styleId_paid_key" ON "TemplatePurchase"("storeId", "styleId") WHERE "status" = 'PAID';
