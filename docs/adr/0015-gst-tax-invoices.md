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

**Tax-inclusive prices (added 2026-11-19).** `Store.pricesIncludeTax` (Settings → Taxes, "Prices
and tax"). When on, product prices and shipping rates hold their tax: `priceCart` takes out
`amount × r / (1 + r)` per rate group (rounded once per rate, like added tax) and the total is the
price the shopper saw. Destinations with no tax rate pay the same price with no tax taken out. Orders
and drafts record `taxesIncluded`, so a later switch never changes them; the order total check
constraint allows `total = subtotal − discount + shipping` for those orders. Invoices print the
taxable value as the line value less its tax, credit notes and the suggested return refund use the
price paid (no tax on top). The storefront says "Tax included." on product pages and the cart, and
checkout, order and invoice pages label the tax "(included)".

**B2B buyers (added 2026-11-19).** Indian checkouts can add the buyer's GSTIN (validated like the
store's, including the check digit) and registered name, stored on `Order.buyerGstin` /
`buyerLegalName`. The invoice is issued to the business name and prints its GSTIN, so the buyer can
claim input tax credit. Place of supply stays the delivery state. Draft orders take the same two
fields (Customer card) and pass them to the order they create; outside India they are dropped.

**GST returns (added 2026-11-19).** Orders → GST returns shows a month (in the store's time zone)
of issued invoices and credit notes sorted into the GSTR-1 tables, built only from the stored
documents (`apps/api/src/orders/gst-returns.ts`, `GET /admin/stores/:id/gst-returns/gstr1?month=`):
B2B (4A, buyer GSTIN), B2CL (5, other-state consumer invoices above Rs 1 lakh), exports (6A, WPAY
when IGST was charged), B2CS (7, by place of supply and rate, net of their credit notes), CDNR and
CDNUR (9B, classified by the invoice the note reduces), HSN summary split B2B/B2C (12, net of credit
notes; quantities only from invoices, shipping as SAC 9965 with UQC NA) and the document ranges (13).
Each table downloads as CSV with the GST Offline Tool's template headings (`gstr1Csv` in contracts),
and the whole month as the portal's offline-upload JSON (`gstr1Json`: offline tool schema, rupees,
dd-mm-yyyy dates, `fp` MMYYYY, HSN split into `hsn_b2b`/`hsn_b2c`). The JSON was written from the
published schema and not yet validated in the offline tool; the page tells merchants to open it
there before uploading.
Warnings flag non-INR documents, missing HSN codes, blank places of supply, several GSTINs and
test-mode payments. The same page shows GSTR-3B tables 3.1(a)-(c) (taxable, zero-rated = exports,
nil-rated = 0% rows in India) and 3.2 (other-state sales to unregistered buyers by place of supply),
all net of credit notes. Input tax credit (table 4) is not tracked: the store has no purchase tax
data. It prepares figures only; nothing is filed. "All invoices (PDF)" opens
`/tax-invoice/:store/month/:month`: every invoice then credit note of the month, one per printed
page, 100 per part (`GET …/gst-returns/documents?month=&page=`), to print or save as PDF for records.

## Input tax credit (GSTR-3B table 4)

Suppliers carry a GSTIN; purchase-order lines and shipping carry a GST rate (unit cost is before
GST); a purchase order carries the supplier invoice date, which can be recorded after ordering
(`PUT …/purchase-orders/:id/invoice`). Table 4(A)(5) counts GST on **received** units of received
or partially received orders whose invoice date falls in the month, only from suppliers with a
GSTIN: CGST + SGST when the GSTIN state code matches the store's, IGST otherwise. Each supplier
invoice is listed to match against GSTR-2B; the page warns about GST-bearing orders without an
invoice date or from unregistered suppliers. Blocked credit (section 17(5)) and ITC reversals are
left to the merchant.

## Not done

- E-invoicing (IRN/QR from the IRP), mandatory only above the turnover limit.
- RCM inward supplies (3.1(d)), ITC reversals (4(B)) and imports (4(A)(1)).
- Filing GSTR-1 or GSTR-3B through a GSP.
- Checking a buyer's GSTIN against the GST portal (only its format and check digit are checked).
- Signature: the invoice has an "Authorised signatory" space, not a digital signature.
- A refund that a provider reports as failed later (after it was accepted) keeps its credit
  note; cancel it by hand.
- Invoices are erased with the store's data when a closed store is deleted; merchants must keep
  their own copies for the retention period GST law requires (the month print above makes that one
  step per month).
