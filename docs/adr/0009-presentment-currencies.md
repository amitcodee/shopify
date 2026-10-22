# ADR 0009 — Selling in several currencies (presentment currencies)

- Status: Accepted
- Date: 2026-10-21

## Context

Merchants sell abroad and shoppers expect prices and payment in their own currency. Catalog
prices, shipping rates, discount amounts and reports are all kept in the store currency today.

## Decision

- A store lists extra **presentment currencies**, each with a merchant-set rate (units per 1
  store unit) and a rounding rule for product prices: exact, whole units, or charm (x.99), always
  rounding up. They live as validated JSON on `Store` (a global table), so the storefront
  resolver can read them before any tenant context exists.
- The storefront sends the shopper's choice in `x-storefront-currency` (from a cookie set by a
  plain GET switcher). The guard switches `shop.currency` only to a currency the store enabled;
  anything else falls back to the store currency.
- **Conversion points:** every place a catalog price is read for a shopper (product cards,
  product page, cart, checkout quote) uses `shopPrice` (rate + rounding); shipping charges and
  fixed discounts use `shopAmount` (exact). Shipping conditions and discount minimums are
  evaluated against the store-currency subtotal, as configured.
- **Orders** are created, priced, taxed and charged in the presentment currency, with
  `exchangeRate` = order-currency minor units per store minor unit. Reports (analytics, customer
  spend, segments) divide by it, so they stay in the store currency.
- A presentment currency must be chargeable by the store's gateway (Razorpay: INR only); it is
  refused when saved and re-checked at checkout.
- Gift cards keep the currency they were issued in; draft orders use the store currency.

## Consequences

- Rates are manual (no live FX feed); merchants update them in Settings → Currencies.
- Refunds happen in the order currency through the same refund path; payouts and FX
  settlement are the payment provider's.
- Platform-wide GMV still sums store currencies as before (unchanged by this ADR).
