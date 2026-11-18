# ADR 0015: GST tax invoices

## Context

Indian merchants registered for GST must give buyers a tax invoice: their GSTIN, a number that runs
in sequence through the financial year, the place of supply, HSN codes, the taxable value and the
tax split into CGST + SGST (same state) or IGST (another state). The platform charged one tax rate
per destination, kept only the order's total tax, and printed no invoice. Products in India sit in
different GST slabs (5%, 12%, 18%, 28%), so one rate per destination was not enough either.

## Decision

**Registration.** `Store.gstRegistration` (JSON: GSTIN, legal name, registered address, invoice
prefix, plus the state taken from the GSTIN's first two digits). The GSTIN is checked for format,
state code and its check digit. Stores without it issue no invoices. Edited in Settings → Taxes.

**Per-product rate.** `Product.taxRateBps` (null = the destination's rate) is used instead of the
destination rate, but only where the destination is taxed at all, so exports and untaxed
countries stay untaxed. `priceCart` now rounds tax once per rate and splits it across the lines
(and shipping) at that rate by taxable value. With no product rates the result is the same as
before. Orders keep each line's rate, tax and HS/HSN code (`OrderLine.taxRateBps`, `taxTotal`,
`hsCode`) and the shipping tax (`Order.shippingTaxTotal`). HS codes now accept 4 to 10 digits,
since small businesses print 4-digit HSN codes.

**Invoices.** `OrderInvoice` (RLS): one per order, `number` like `INV/26-27/0001` (at most 16
characters, as GST rules require), `sequence` unique per store and financial year (April to March,
in the store's time zone), and `data`, a snapshot of everything printed. An advisory transaction
lock per store and year serialises numbering so there are no gaps or duplicates. An issued invoice
never changes: later edits to the registration or products do not touch it.

- Issued automatically when an order is paid (online, manual, free, or cash collected) and when it
  is first fulfilled (so cash-on-delivery parcels can carry one). Unpaid online orders and
  cancelled orders get none.
- Orders from before registration can be issued from the invoice page; they take the next number.
- Place of supply is the delivery state, matched from the address region by GST code, ISO code,
  vehicle code or name. Same state as the GSTIN: CGST + SGST (half each, odd paise to SGST).
  Otherwise IGST. Unmatched Indian regions are treated as another state and printed as typed.
  Deliveries outside India are marked as exports. Shipping is its own row under SAC 9965 at the
  destination rate.
- Orders placed before per-line tax was stored have their total tax split by line value.
- Refunds on an invoiced order issue a credit note (`CreditNote`, RLS) in its own series
  (`CN/26-27/0001`), against the invoice. The amount is split over the invoice's HSN/rate rows by
  the value of the items being returned (the items restocked, or a return's items); a refund that
  names no items is split by each row's value. Each part is divided into taxable value and tax at
  that row's rate. One credit note per refund (unique on `refundId`). It is printed after the
  invoice on both invoice pages, each on its own page.
- Checkout shows a state dropdown when the country is India, storing the state's short code (MH,
  KA, DL…), so tax rates by region and the place of supply match exactly.
- Admin: printable page `/tax-invoice/:store/:order` (print or save as PDF). Shoppers get the same
  document from their order-status page (`GET /storefront/orders/:token/invoice`). Both use
  `packages/invoice-view`.

## Not done

- B2B: the buyer's GSTIN at checkout, and e-invoicing (IRN/QR from the IRP), which is mandatory
  only above the turnover limit.
- Tax-inclusive prices (MRP). Prices are still before tax, so merchants who quote GST-inclusive
  prices must enter prices without GST.
- Signature: the invoice has an "Authorised signatory" space, not a digital signature.
- A refund that a provider reports as failed later (after it was accepted) keeps its credit
  note; cancel it by hand.
- Invoices are erased with the store's data when a closed store is deleted; merchants must keep
  their own copies for the retention period GST law requires.
