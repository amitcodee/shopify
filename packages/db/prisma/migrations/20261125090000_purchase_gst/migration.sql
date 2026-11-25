-- Input tax credit: suppliers' GSTINs, GST rates on purchase orders and the supplier invoice date.
ALTER TABLE "PurchaseOrder" ADD COLUMN     "shippingTaxRateBps" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "supplierInvoiceDate" DATE;

ALTER TABLE "PurchaseOrderLine" ADD COLUMN     "taxRateBps" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Supplier" ADD COLUMN     "gstin" TEXT NOT NULL DEFAULT '';

ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_taxRateBps_range" CHECK ("taxRateBps" BETWEEN 0 AND 10000);
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_shippingTaxRateBps_range" CHECK ("shippingTaxRateBps" BETWEEN 0 AND 10000);
