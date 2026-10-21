-- Returns.

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('REQUESTED', 'OPEN', 'DECLINED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ReturnReason" AS ENUM ('SIZE', 'DAMAGED', 'NOT_AS_DESCRIBED', 'WRONG_ITEM', 'CHANGED_MIND', 'OTHER');

-- CreateTable
CREATE TABLE "Return" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "status" "ReturnStatus" NOT NULL,
    "requestedByCustomer" BOOLEAN NOT NULL DEFAULT false,
    "customerNote" TEXT,
    "declineReason" TEXT,
    "refundId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Return_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnLine" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "returnId" UUID NOT NULL,
    "orderLineId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" "ReturnReason" NOT NULL,

    CONSTRAINT "ReturnLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Return_storeId_status_createdAt_idx" ON "Return"("storeId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Return_orderId_idx" ON "Return"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Return_storeId_id_key" ON "Return"("storeId", "id");

-- CreateIndex
CREATE INDEX "ReturnLine_orderLineId_idx" ON "ReturnLine"("orderLineId");

-- CreateIndex
CREATE UNIQUE INDEX "ReturnLine_returnId_orderLineId_key" ON "ReturnLine"("returnId", "orderLineId");

-- AddForeignKey
ALTER TABLE "Return" ADD CONSTRAINT "Return_storeId_orderId_fkey" FOREIGN KEY ("storeId", "orderId") REFERENCES "Order"("storeId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnLine" ADD CONSTRAINT "ReturnLine_storeId_returnId_fkey" FOREIGN KEY ("storeId", "returnId") REFERENCES "Return"("storeId", "id") ON DELETE CASCADE ON UPDATE CASCADE;


SELECT app_enable_tenant_rls('"Return"');
SELECT app_enable_tenant_rls('"ReturnLine"');
ALTER TABLE "ReturnLine" ADD CONSTRAINT "ReturnLine_quantity_positive" CHECK ("quantity" > 0);
