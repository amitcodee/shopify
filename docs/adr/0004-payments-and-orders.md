# ADR 0004 — Payments, checkout and order integrity

- Status: Accepted
- Date: 2026-10-19

## Decisions

**Hosted payment pages only (PCI SAQ-A).** Card data never touches our servers. A
`PaymentProvider` port has two adapters:

- `mock` — sandbox for development/tests. The shopper sees a clearly labelled sandbox page; the
  outcome is delivered as an HMAC-signed webhook through the _same_ verification,
  de-duplication and order code as a real provider. Refused at startup in production.
- `stripe` — Stripe Checkout Sessions (test keys in development). Orders are marked paid only
  from a verified `checkout.session.completed` webhook (`stripe.webhooks.constructEvent`), never
  from the browser redirect. Signature parsing is unit-tested offline.

**Checkout transaction.** One tenant transaction: re-validate the cart, price it server-side
(`priceCart`: integer minor units, half-up rounding, largest-remainder discount allocation),
reserve stock with conditional decrements (`... WHERE inventoryQuantity >= qty RETURNING`),
allocate the order number (`INSERT … ON CONFLICT DO UPDATE … RETURNING`), create the order and
its line snapshots. The payment provider is called _after_ commit (no network I/O inside DB
transactions). A client idempotency key makes retries return the same order/payment.

**Webhooks.** Unknown or tampered signatures → 400. Each event id is recorded in
`WebhookEvent`; duplicates are acknowledged without reprocessing; if processing fails the
record is removed so the provider's retry is processed. The paid amount and currency must match
the payment record or the payment is rejected and flagged on the order timeline.

**Lifecycle.** `PENDING_PAYMENT → OPEN → (fulfilled)` or `→ CANCELLED`. Unpaid orders release
stock after `ORDER_PAYMENT_TIMEOUT_MINUTES` (background job) or when the shopper restarts
checkout. Refunds commit a `Refund` row before calling the provider so concurrent refunds can
never exceed the paid amount. Database CHECK constraints enforce `total = subtotal − discount +
shipping + tax` and non-negative amounts.

**Order-status links** are `<orderId>.<HMAC>` tokens: deterministic (emails sent later from the
webhook can rebuild them), unforgeable, and only their SHA-256 is stored.

**Notifications** go through a transactional outbox (written in the same transaction as the
change) delivered by a worker with `FOR UPDATE SKIP LOCKED` and exponential backoff.

## Known limitations / next steps

- ~~Platform-level Stripe account~~ — superseded by [ADR 0006](0006-stripe-connect-payouts.md):
  sales are Stripe Connect destination charges to each store's account, minus the plan fee.
- One payment per order; partial captures and multiple tenders are out of scope.
- 3-D Secure / SCA is handled by Stripe Checkout itself.
