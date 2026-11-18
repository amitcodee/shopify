-- GST credit notes for refunds on invoiced orders (ADR 0015).

-- CreateTable
CREATE TABLE "CreditNote" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "refundId" UUID,
    "number" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data" JSONB NOT NULL,

    CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreditNote_orderId_idx" ON "CreditNote"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditNote_storeId_financialYear_sequence_key" ON "CreditNote"("storeId", "financialYear", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "CreditNote_storeId_number_key" ON "CreditNote"("storeId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "CreditNote_storeId_refundId_key" ON "CreditNote"("storeId", "refundId");

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_storeId_orderId_fkey" FOREIGN KEY ("storeId", "orderId") REFERENCES "Order"("storeId", "id") ON DELETE CASCADE ON UPDATE CASCADE;


SELECT app_enable_tenant_rls('"CreditNote"');
