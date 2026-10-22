-- Presentment currencies (multi-currency storefronts).

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "exchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "presentmentCurrencies" JSONB NOT NULL DEFAULT '[]';


ALTER TABLE "Order" ADD CONSTRAINT "Order_exchangeRate_positive" CHECK ("exchangeRate" > 0);
ALTER TABLE "Store" ADD CONSTRAINT "Store_presentmentCurrencies_array" CHECK (jsonb_typeof("presentmentCurrencies") = 'array');
