-- Suppliers and purchase orders, bundles (combos), option display styles and shopper customizations.

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "InventoryReason" ADD VALUE 'PURCHASE_ORDER';

-- DropIndex
DROP INDEX "CartLine_cartId_variantId_key";

-- AlterTable
ALTER TABLE "CartLine" ADD COLUMN     "customKey" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "customization" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "OrderCounter" ADD COLUMN     "nextPurchaseOrder" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "OrderLine" ADD COLUMN     "components" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "properties" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "customizations" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "isBundle" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "supplierId" UUID;

-- AlterTable
ALTER TABLE "ProductOption" ADD COLUMN     "style" TEXT NOT NULL DEFAULT 'buttons',
ADD COLUMN     "swatches" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "BundleComponent" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "bundleVariantId" UUID NOT NULL,
    "componentVariantId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BundleComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "website" TEXT NOT NULL DEFAULT '',
    "leadTimeDays" INTEGER,
    "notes" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "supplierId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "supplierReference" TEXT NOT NULL DEFAULT '',
    "expectedAt" TIMESTAMP(3),
    "shippingCost" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "orderedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderLine" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "purchaseOrderId" UUID NOT NULL,
    "variantId" UUID,
    "productTitle" TEXT NOT NULL,
    "variantTitle" TEXT NOT NULL,
    "sku" TEXT,
    "supplierSku" TEXT NOT NULL DEFAULT '',
    "quantity" INTEGER NOT NULL,
    "receivedQuantity" INTEGER NOT NULL DEFAULT 0,
    "unitCost" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PurchaseOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BundleComponent_storeId_componentVariantId_idx" ON "BundleComponent"("storeId", "componentVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "BundleComponent_bundleVariantId_componentVariantId_key" ON "BundleComponent"("bundleVariantId", "componentVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_storeId_id_key" ON "Supplier"("storeId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_storeId_name_key" ON "Supplier"("storeId", "name");

-- CreateIndex
CREATE INDEX "PurchaseOrder_storeId_status_createdAt_idx" ON "PurchaseOrder"("storeId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PurchaseOrder_storeId_supplierId_idx" ON "PurchaseOrder"("storeId", "supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_storeId_id_key" ON "PurchaseOrder"("storeId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_storeId_number_key" ON "PurchaseOrder"("storeId", "number");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_purchaseOrderId_idx" ON "PurchaseOrderLine"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_variantId_idx" ON "PurchaseOrderLine"("variantId");

-- CreateIndex
CREATE UNIQUE INDEX "CartLine_cartId_variantId_customKey_key" ON "CartLine"("cartId", "variantId", "customKey");

-- CreateIndex
CREATE INDEX "Product_supplierId_idx" ON "Product"("supplierId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleComponent" ADD CONSTRAINT "BundleComponent_storeId_bundleVariantId_fkey" FOREIGN KEY ("storeId", "bundleVariantId") REFERENCES "ProductVariant"("storeId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleComponent" ADD CONSTRAINT "BundleComponent_storeId_componentVariantId_fkey" FOREIGN KEY ("storeId", "componentVariantId") REFERENCES "ProductVariant"("storeId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_storeId_supplierId_fkey" FOREIGN KEY ("storeId", "supplierId") REFERENCES "Supplier"("storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_storeId_locationId_fkey" FOREIGN KEY ("storeId", "locationId") REFERENCES "Location"("storeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_storeId_purchaseOrderId_fkey" FOREIGN KEY ("storeId", "purchaseOrderId") REFERENCES "PurchaseOrder"("storeId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;


SELECT app_enable_tenant_rls('"BundleComponent"');
SELECT app_enable_tenant_rls('"Supplier"');
SELECT app_enable_tenant_rls('"PurchaseOrder"');
SELECT app_enable_tenant_rls('"PurchaseOrderLine"');

ALTER TABLE "BundleComponent" ADD CONSTRAINT "BundleComponent_quantity_positive" CHECK ("quantity" BETWEEN 1 AND 100);
ALTER TABLE "BundleComponent" ADD CONSTRAINT "BundleComponent_not_itself" CHECK ("bundleVariantId" <> "componentVariantId");
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_quantities" CHECK ("quantity" > 0 AND "receivedQuantity" >= 0 AND "unitCost" >= 0);
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_shippingCost_nonnegative" CHECK ("shippingCost" >= 0);
ALTER TABLE "ProductOption" ADD CONSTRAINT "ProductOption_style_known" CHECK ("style" IN ('buttons', 'dropdown', 'swatches'));

-- The supplier and purchase-order variant FKs are single-column (so ON DELETE SET NULL leaves
-- storeId alone); these triggers keep the guarantee composite keys give elsewhere: the row
-- they point at belongs to the same store.
CREATE OR REPLACE FUNCTION app_check_product_supplier() RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."supplierId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "Supplier" s WHERE s.id = NEW."supplierId" AND s."storeId" = NEW."storeId"
  ) THEN
    RAISE EXCEPTION 'supplier must belong to the same store' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Product_supplier_same_store"
  BEFORE INSERT OR UPDATE OF "supplierId" ON "Product"
  FOR EACH ROW EXECUTE FUNCTION app_check_product_supplier();

CREATE OR REPLACE FUNCTION app_check_purchase_order_line_variant() RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."variantId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "ProductVariant" v WHERE v.id = NEW."variantId" AND v."storeId" = NEW."storeId"
  ) THEN
    RAISE EXCEPTION 'variant must belong to the same store' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "PurchaseOrderLine_variant_same_store"
  BEFORE INSERT OR UPDATE OF "variantId" ON "PurchaseOrderLine"
  FOR EACH ROW EXECUTE FUNCTION app_check_purchase_order_line_variant();
