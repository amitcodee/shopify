-- Inventory locations. ProductVariant.inventoryQuantity stays the total across locations.

-- AlterTable
ALTER TABLE "InventoryAdjustment" ADD COLUMN     "locationId" UUID;

-- AlterTable
ALTER TABLE "OrderLine" ADD COLUMN     "locationId" UUID;

-- CreateTable
CREATE TABLE "Location" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryLevel" (
    "storeId" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "available" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryLevel_pkey" PRIMARY KEY ("variantId","locationId")
);

-- CreateIndex
CREATE INDEX "Location_storeId_priority_idx" ON "Location"("storeId", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "Location_storeId_id_key" ON "Location"("storeId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Location_storeId_name_key" ON "Location"("storeId", "name");

-- CreateIndex
CREATE INDEX "InventoryLevel_storeId_locationId_idx" ON "InventoryLevel"("storeId", "locationId");

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLevel" ADD CONSTRAINT "InventoryLevel_storeId_variantId_fkey" FOREIGN KEY ("storeId", "variantId") REFERENCES "ProductVariant"("storeId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLevel" ADD CONSTRAINT "InventoryLevel_storeId_locationId_fkey" FOREIGN KEY ("storeId", "locationId") REFERENCES "Location"("storeId", "id") ON DELETE CASCADE ON UPDATE CASCADE;


-- One default location per store.
CREATE UNIQUE INDEX "Location_one_default_per_store" ON "Location"("storeId") WHERE "isDefault";

-- Backfill: every store gets a default location holding its current stock. Forced RLS binds the
-- table owner too, so it is lifted for these statements and enabled on the new tables after.
ALTER TABLE "ProductVariant" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "OrderLine" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "InventoryAdjustment" NO FORCE ROW LEVEL SECURITY;

INSERT INTO "Location" ("id", "storeId", "name", "isDefault", "active", "priority", "createdAt", "updatedAt")
SELECT gen_random_uuid(), s."id", 'Main location', true, true, 0, now(), now() FROM "Store" s;

INSERT INTO "InventoryLevel" ("storeId", "variantId", "locationId", "available", "updatedAt")
SELECT v."storeId", v."id", l."id", v."inventoryQuantity", now()
FROM "ProductVariant" v JOIN "Location" l ON l."storeId" = v."storeId" AND l."isDefault";

UPDATE "OrderLine" ol SET "locationId" = l."id"
FROM "Location" l WHERE l."storeId" = ol."storeId" AND l."isDefault" AND ol."stockReserved";

UPDATE "InventoryAdjustment" a SET "locationId" = l."id"
FROM "Location" l WHERE l."storeId" = a."storeId" AND l."isDefault";

ALTER TABLE "ProductVariant" FORCE ROW LEVEL SECURITY;
ALTER TABLE "OrderLine" FORCE ROW LEVEL SECURITY;
ALTER TABLE "InventoryAdjustment" FORCE ROW LEVEL SECURITY;

SELECT app_enable_tenant_rls('"Location"');
SELECT app_enable_tenant_rls('"InventoryLevel"');
