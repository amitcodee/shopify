-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "InventoryReason" AS ENUM ('INITIAL', 'MANUAL', 'RESTOCK', 'CORRECTION', 'DAMAGED', 'ORDER', 'ORDER_CANCELLED', 'RETURN');

-- CreateTable
CREATE TABLE "StoreInvitation" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "StoreRole" NOT NULL,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tokenHash" TEXT NOT NULL,
    "invitedByUserId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "vendor" TEXT,
    "productType" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductOption" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "values" TEXT[],

    CONSTRAINT "ProductOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "options" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sku" TEXT,
    "barcode" TEXT,
    "price" INTEGER NOT NULL,
    "compareAtPrice" INTEGER,
    "weightGrams" INTEGER NOT NULL DEFAULT 0,
    "requiresShipping" BOOLEAN NOT NULL DEFAULT true,
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "trackInventory" BOOLEAN NOT NULL DEFAULT true,
    "allowBackorder" BOOLEAN NOT NULL DEFAULT false,
    "inventoryQuantity" INTEGER NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryAdjustment" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "delta" INTEGER NOT NULL,
    "quantityAfter" INTEGER NOT NULL,
    "reason" "InventoryReason" NOT NULL,
    "note" TEXT,
    "actorUserId" UUID,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "alt" TEXT NOT NULL DEFAULT '',
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "ruleTag" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionProduct" (
    "storeId" UUID NOT NULL,
    "collectionId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CollectionProduct_pkey" PRIMARY KEY ("collectionId","productId")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreInvitation_tokenHash_key" ON "StoreInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "StoreInvitation_storeId_idx" ON "StoreInvitation"("storeId");

-- CreateIndex
CREATE INDEX "Product_storeId_status_updatedAt_idx" ON "Product"("storeId", "status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Product_storeId_id_key" ON "Product"("storeId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Product_storeId_handle_key" ON "Product"("storeId", "handle");

-- CreateIndex
CREATE UNIQUE INDEX "ProductOption_productId_position_key" ON "ProductOption"("productId", "position");

-- CreateIndex
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_storeId_id_key" ON "ProductVariant"("storeId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_storeId_sku_key" ON "ProductVariant"("storeId", "sku");

-- CreateIndex
CREATE INDEX "InventoryAdjustment_storeId_variantId_createdAt_idx" ON "InventoryAdjustment"("storeId", "variantId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductImage_productId_position_idx" ON "ProductImage"("productId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_storeId_id_key" ON "Collection"("storeId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_storeId_handle_key" ON "Collection"("storeId", "handle");

-- CreateIndex
CREATE INDEX "CollectionProduct_storeId_productId_idx" ON "CollectionProduct"("storeId", "productId");

-- AddForeignKey
ALTER TABLE "StoreInvitation" ADD CONSTRAINT "StoreInvitation_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOption" ADD CONSTRAINT "ProductOption_storeId_productId_fkey" FOREIGN KEY ("storeId", "productId") REFERENCES "Product"("storeId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_storeId_productId_fkey" FOREIGN KEY ("storeId", "productId") REFERENCES "Product"("storeId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryAdjustment" ADD CONSTRAINT "InventoryAdjustment_storeId_variantId_fkey" FOREIGN KEY ("storeId", "variantId") REFERENCES "ProductVariant"("storeId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_storeId_productId_fkey" FOREIGN KEY ("storeId", "productId") REFERENCES "Product"("storeId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionProduct" ADD CONSTRAINT "CollectionProduct_storeId_collectionId_fkey" FOREIGN KEY ("storeId", "collectionId") REFERENCES "Collection"("storeId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionProduct" ADD CONSTRAINT "CollectionProduct_storeId_productId_fkey" FOREIGN KEY ("storeId", "productId") REFERENCES "Product"("storeId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-level security for the new tenant tables (see 20261019090000_tenant_rls).
SELECT app_enable_tenant_rls('"Product"');
SELECT app_enable_tenant_rls('"ProductOption"');
SELECT app_enable_tenant_rls('"ProductVariant"');
SELECT app_enable_tenant_rls('"InventoryAdjustment"');
SELECT app_enable_tenant_rls('"ProductImage"');
SELECT app_enable_tenant_rls('"Collection"');
SELECT app_enable_tenant_rls('"CollectionProduct"');

-- Inventory history is append-only for the application role.
REVOKE UPDATE, DELETE ON "InventoryAdjustment" FROM shop_app;

-- Integrity guards.
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_price_nonnegative" CHECK ("price" >= 0);
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_compare_at_nonnegative" CHECK ("compareAtPrice" IS NULL OR "compareAtPrice" >= 0);
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_weight_nonnegative" CHECK ("weightGrams" >= 0);
