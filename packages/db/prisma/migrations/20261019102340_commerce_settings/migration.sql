-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING');

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "themePreset" TEXT NOT NULL DEFAULT 'minimal',
ADD COLUMN     "themeSettings" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "Domain" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "hostname" TEXT NOT NULL,
    "verificationToken" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Domain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShippingZone" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "countries" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShippingZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShippingRate" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "zoneId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "minSubtotal" INTEGER,
    "maxSubtotal" INTEGER,
    "minWeightGrams" INTEGER,
    "maxWeightGrams" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShippingRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxRate" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "country" CHAR(2) NOT NULL,
    "region" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "rateBps" INTEGER NOT NULL,
    "appliesToShipping" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountCode" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "type" "DiscountType" NOT NULL,
    "value" INTEGER NOT NULL,
    "minSubtotal" INTEGER,
    "usageLimit" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscountCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Domain_hostname_key" ON "Domain"("hostname");

-- CreateIndex
CREATE INDEX "Domain_storeId_idx" ON "Domain"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "ShippingZone_storeId_id_key" ON "ShippingZone"("storeId", "id");

-- CreateIndex
CREATE INDEX "ShippingRate_zoneId_idx" ON "ShippingRate"("zoneId");

-- CreateIndex
CREATE UNIQUE INDEX "TaxRate_storeId_country_region_key" ON "TaxRate"("storeId", "country", "region");

-- CreateIndex
CREATE UNIQUE INDEX "DiscountCode_storeId_code_key" ON "DiscountCode"("storeId", "code");

-- AddForeignKey
ALTER TABLE "Domain" ADD CONSTRAINT "Domain_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShippingZone" ADD CONSTRAINT "ShippingZone_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShippingRate" ADD CONSTRAINT "ShippingRate_storeId_zoneId_fkey" FOREIGN KEY ("storeId", "zoneId") REFERENCES "ShippingZone"("storeId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRate" ADD CONSTRAINT "TaxRate_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountCode" ADD CONSTRAINT "DiscountCode_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-level security for shipping, tax and discount configuration.
SELECT app_enable_tenant_rls('"ShippingZone"');
SELECT app_enable_tenant_rls('"ShippingRate"');
SELECT app_enable_tenant_rls('"TaxRate"');
SELECT app_enable_tenant_rls('"DiscountCode"');

ALTER TABLE "ShippingRate" ADD CONSTRAINT "ShippingRate_price_nonnegative" CHECK ("price" >= 0);
ALTER TABLE "TaxRate" ADD CONSTRAINT "TaxRate_rate_range" CHECK ("rateBps" BETWEEN 0 AND 10000);
ALTER TABLE "DiscountCode" ADD CONSTRAINT "DiscountCode_value_valid" CHECK ("value" >= 0 AND ("type" <> 'PERCENTAGE' OR "value" BETWEEN 1 AND 100));
ALTER TABLE "DiscountCode" ADD CONSTRAINT "DiscountCode_usage_valid" CHECK ("usedCount" >= 0 AND ("usageLimit" IS NULL OR "usedCount" <= "usageLimit"));

-- At most one primary domain per store.
CREATE UNIQUE INDEX "Domain_one_primary_per_store" ON "Domain" ("storeId") WHERE "isPrimary";
