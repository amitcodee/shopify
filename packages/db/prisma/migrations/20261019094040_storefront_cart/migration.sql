-- CreateTable
CREATE TABLE "Cart" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartLine" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "cartId" UUID NOT NULL,
    "variantId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cart_tokenHash_key" ON "Cart"("tokenHash");

-- CreateIndex
CREATE INDEX "Cart_storeId_updatedAt_idx" ON "Cart"("storeId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_storeId_id_key" ON "Cart"("storeId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "CartLine_cartId_variantId_key" ON "CartLine"("cartId", "variantId");

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartLine" ADD CONSTRAINT "CartLine_storeId_cartId_fkey" FOREIGN KEY ("storeId", "cartId") REFERENCES "Cart"("storeId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartLine" ADD CONSTRAINT "CartLine_storeId_variantId_fkey" FOREIGN KEY ("storeId", "variantId") REFERENCES "ProductVariant"("storeId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-level security for carts.
SELECT app_enable_tenant_rls('"Cart"');
SELECT app_enable_tenant_rls('"CartLine"');

ALTER TABLE "CartLine" ADD CONSTRAINT "CartLine_quantity_range" CHECK ("quantity" BETWEEN 1 AND 999);

-- Storefront full-text search: an immutable document function + expression GIN index.
-- ('simple' config = no stemming, works for any language; prefix matching is done in the query.)
CREATE OR REPLACE FUNCTION app_product_search_document(title text, description text, tags text[])
  RETURNS tsvector
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT setweight(to_tsvector('simple', coalesce(title, '')), 'A')
      || setweight(to_tsvector('simple', coalesce(array_to_string(tags, ' '), '')), 'B')
      || setweight(to_tsvector('simple', coalesce(description, '')), 'C')
$$;

CREATE INDEX "Product_search_idx" ON "Product"
  USING GIN (app_product_search_document("title", "description", "tags"));
