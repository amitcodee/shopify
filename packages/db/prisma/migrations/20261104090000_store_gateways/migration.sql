-- CreateTable
CREATE TABLE "StoreGateway" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "credentialsEnc" TEXT NOT NULL,
    "keyHint" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreGateway_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreGateway_storeId_provider_key" ON "StoreGateway"("storeId", "provider");

-- A store has at most one gateway taking payments.
CREATE UNIQUE INDEX "StoreGateway_one_active_per_store" ON "StoreGateway"("storeId") WHERE "active";

-- AddForeignKey
ALTER TABLE "StoreGateway" ADD CONSTRAINT "StoreGateway_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

SELECT app_enable_tenant_rls('"StoreGateway"');
