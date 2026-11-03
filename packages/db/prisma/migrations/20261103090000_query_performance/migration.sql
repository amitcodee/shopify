-- Faster storefront listings and search, measured on 20,000 products with the app role.
--
-- Row-level security stops PostgreSQL using GIN indexes for `@@`, because that operator is not
-- leakproof, so search scanned the store and rebuilt each product's document. A stored column
-- removes the rebuild (about 400 ms down to 27 ms). The expression index is dropped because no
-- query can use it any more. Adding the column rewrites the table and blocks writes meanwhile.
ALTER TABLE "Product" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (app_product_search_document("title", "description", "tags")) STORED;
DROP INDEX "Product_search_idx";

-- Matches the default listing sort (first page: about 125 ms down to under 1 ms).
CREATE INDEX "Product_storeId_listing_idx" ON "Product"
  ("storeId", "publishedAt" DESC NULLS LAST, "createdAt" DESC, "id");
CREATE INDEX "Product_storeId_title_id_idx" ON "Product"("storeId", "title", "id");

-- Queries filtered or sorted on these columns had no matching index.
CREATE INDEX "Customer_storeId_createdAt_idx" ON "Customer"("storeId", "createdAt");
CREATE INDEX "Order_storeId_cartId_idx" ON "Order"("storeId", "cartId");
CREATE INDEX "Refund_storeId_createdAt_idx" ON "Refund"("storeId", "createdAt");
