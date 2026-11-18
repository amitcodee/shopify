-- GST tax invoices (ADR 0015): store GST registration, per-product tax rate, per-line tax
-- on orders, and numbered invoices per financial year.

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "shippingTaxTotal" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "OrderLine" ADD COLUMN     "hsCode" TEXT,
ADD COLUMN     "taxRateBps" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "taxTotal" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "taxRateBps" INTEGER;

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "gstRegistration" JSONB;

-- CreateTable
CREATE TABLE "OrderInvoice" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data" JSONB NOT NULL,

    CONSTRAINT "OrderInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderInvoice_storeId_orderId_key" ON "OrderInvoice"("storeId", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderInvoice_storeId_financialYear_sequence_key" ON "OrderInvoice"("storeId", "financialYear", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "OrderInvoice_storeId_number_key" ON "OrderInvoice"("storeId", "number");

-- AddForeignKey
ALTER TABLE "OrderInvoice" ADD CONSTRAINT "OrderInvoice_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderInvoice" ADD CONSTRAINT "OrderInvoice_storeId_orderId_fkey" FOREIGN KEY ("storeId", "orderId") REFERENCES "Order"("storeId", "id") ON DELETE CASCADE ON UPDATE CASCADE;


SELECT app_enable_tenant_rls('"OrderInvoice"');
