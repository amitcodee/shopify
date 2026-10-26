-- Product media (renditions, variant images), cost, customs fields, metafields, scheduling.
-- CreateEnum
CREATE TYPE "MetafieldType" AS ENUM ('single_line_text', 'multi_line_text', 'number_integer', 'number_decimal', 'boolean', 'url', 'date');

-- AlterTable
ALTER TABLE "ProductImage" ADD COLUMN     "renditionWidths" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "costPerItem" INTEGER,
ADD COLUMN     "countryOfOrigin" TEXT,
ADD COLUMN     "hsCode" TEXT,
ADD COLUMN     "imageId" UUID;

-- CreateTable
CREATE TABLE "ProductMetafield" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "namespace" TEXT NOT NULL DEFAULT 'custom',
    "key" TEXT NOT NULL,
    "type" "MetafieldType" NOT NULL,
    "value" TEXT NOT NULL,
    "showOnStorefront" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductMetafield_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductMetafield_storeId_productId_idx" ON "ProductMetafield"("storeId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductMetafield_productId_namespace_key_key" ON "ProductMetafield"("productId", "namespace", "key");

-- CreateIndex
CREATE INDEX "ProductVariant_imageId_idx" ON "ProductVariant"("imageId");

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "ProductImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMetafield" ADD CONSTRAINT "ProductMetafield_storeId_productId_fkey" FOREIGN KEY ("storeId", "productId") REFERENCES "Product"("storeId", "id") ON DELETE CASCADE ON UPDATE CASCADE;



SELECT app_enable_tenant_rls('"ProductMetafield"');

ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_costPerItem_nonnegative" CHECK ("costPerItem" IS NULL OR "costPerItem" >= 0);
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_countryOfOrigin_format" CHECK ("countryOfOrigin" IS NULL OR "countryOfOrigin" ~ '^[A-Z]{2}$');
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_hsCode_format" CHECK ("hsCode" IS NULL OR "hsCode" ~ '^[0-9]{6,10}$');
ALTER TABLE "ProductMetafield" ADD CONSTRAINT "ProductMetafield_key_format" CHECK ("key" ~ '^[a-z0-9_]{1,40}$');
ALTER TABLE "ProductMetafield" ADD CONSTRAINT "ProductMetafield_namespace_format" CHECK ("namespace" ~ '^[a-z0-9_]{1,20}$');

-- The image FK is single-column (so ON DELETE SET NULL leaves storeId alone); this trigger keeps
-- the guarantee composite keys give elsewhere: a variant may only show an image of its own
-- product (and so of its own store).
CREATE OR REPLACE FUNCTION app_check_variant_image() RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."imageId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "ProductImage" i
    WHERE i.id = NEW."imageId" AND i."storeId" = NEW."storeId" AND i."productId" = NEW."productId"
  ) THEN
    RAISE EXCEPTION 'variant image must belong to the same product' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ProductVariant_image_same_product"
  BEFORE INSERT OR UPDATE OF "imageId" ON "ProductVariant"
  FOR EACH ROW EXECUTE FUNCTION app_check_variant_image();

-- Active products created before scheduling existed are published as of their creation.
ALTER TABLE "Product" NO FORCE ROW LEVEL SECURITY;
UPDATE "Product" SET "publishedAt" = "createdAt" WHERE status = 'ACTIVE' AND "publishedAt" IS NULL;
ALTER TABLE "Product" FORCE ROW LEVEL SECURITY;
