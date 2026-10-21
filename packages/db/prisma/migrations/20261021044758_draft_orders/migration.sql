-- Draft orders: merchant-built orders that are invoiced or marked as paid.

-- CreateEnum
CREATE TYPE "DraftOrderStatus" AS ENUM ('OPEN', 'INVOICE_SENT', 'COMPLETED');

-- AlterTable
ALTER TABLE "OrderCounter" ADD COLUMN     "nextDraft" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "DraftOrder" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "DraftOrderStatus" NOT NULL DEFAULT 'OPEN',
    "customerId" UUID,
    "email" TEXT,
    "lines" JSONB NOT NULL,
    "shippingAddress" JSONB,
    "shippingTitle" TEXT,
    "shippingPrice" INTEGER NOT NULL DEFAULT 0,
    "discountType" TEXT,
    "discountValue" INTEGER,
    "note" TEXT,
    "currency" CHAR(3) NOT NULL,
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "discountTotal" INTEGER NOT NULL DEFAULT 0,
    "shippingTotal" INTEGER NOT NULL DEFAULT 0,
    "taxTotal" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "orderId" UUID,
    "invoiceSentAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DraftOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DraftOrder_storeId_status_createdAt_idx" ON "DraftOrder"("storeId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "DraftOrder_orderId_idx" ON "DraftOrder"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "DraftOrder_storeId_id_key" ON "DraftOrder"("storeId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "DraftOrder_storeId_number_key" ON "DraftOrder"("storeId", "number");

-- AddForeignKey
ALTER TABLE "DraftOrder" ADD CONSTRAINT "DraftOrder_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftOrder" ADD CONSTRAINT "DraftOrder_storeId_customerId_fkey" FOREIGN KEY ("storeId", "customerId") REFERENCES "Customer"("storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftOrder" ADD CONSTRAINT "DraftOrder_storeId_orderId_fkey" FOREIGN KEY ("storeId", "orderId") REFERENCES "Order"("storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

SELECT app_enable_tenant_rls('"DraftOrder"');
ALTER TABLE "DraftOrder" ADD CONSTRAINT "DraftOrder_amounts_non_negative"
  CHECK ("subtotal" >= 0 AND "discountTotal" >= 0 AND "shippingPrice" >= 0 AND "shippingTotal" >= 0
         AND "taxTotal" >= 0 AND "total" >= 0);
ALTER TABLE "DraftOrder" ADD CONSTRAINT "DraftOrder_lines_array" CHECK (jsonb_typeof("lines") = 'array');
