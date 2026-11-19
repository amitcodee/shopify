-- Tax-inclusive orders: the tax is already inside the line prices and shipping.
ALTER TABLE "Order" DROP CONSTRAINT "Order_total_consistent";
ALTER TABLE "Order" ADD CONSTRAINT "Order_total_consistent" CHECK (
  "total" = "subtotal" - "discountTotal" + "shippingTotal" + CASE WHEN "taxesIncluded" THEN 0 ELSE "taxTotal" END
);
