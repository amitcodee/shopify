-- India's HSN codes on GST invoices may have 4 digits (ADR 0015); HS codes stay up to 10.
ALTER TABLE "ProductVariant" DROP CONSTRAINT "ProductVariant_hsCode_format";
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_hsCode_format" CHECK ("hsCode" IS NULL OR "hsCode" ~ '^[0-9]{4,10}$');
