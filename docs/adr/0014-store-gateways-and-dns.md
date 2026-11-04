# ADR 0014: Merchant-owned payment gateways and DNS checks

## Context

Payments ran only through the platform's accounts (Stripe Connect, Razorpay Route), with a plan fee
split off each sale. Merchants asked to use gateway accounts they already have, including Indian
gateways with no Connect-style product. Custom domains showed DNS records but gave no feedback until
ownership verification succeeded, and only as a CNAME, which bare domains cannot use.

## Decision

**Gateways.** A store saves any number of gateways (`StoreGateway`, RLS) with its own keys and marks
one active. An active store gateway takes priority over the payouts account.

- Keys are AES-256-GCM encrypted with `APP_ENCRYPTION_KEY`, write-only over the API, proven against
  the gateway before saving, and left out of logs and audit data (only a masked hint is kept).
- `Payment.provider` is `own_<gateway>` or `own_<gateway>_test`, so analytics can tell test orders
  apart and refunds find the adapter. `destinationAccountId` is `own`.
- No platform fee applies: the money never passes through the platform, so there is nothing to
  split. This is a pricing decision to revisit (for example, a separate subscription charge).
- Webhooks arrive per store (`/webhooks/store-gateways/:storeId/:gateway`), are verified with that
  store's keys, and only look up payments in that store: a merchant controls their own secret, so
  a valid signature must not reach another store's orders. De-duplication is keyed per store too.
- PayU needs a browser form post, served by a small bridge page. PayU, PayPal and PhonePe report on the
  shopper's return: PayU's result is hash-signed, PayPal's is captured server-side by us, and PhonePe's is read from its status API.
- Gateways with `requiresPhone` make checkout ask for a phone before reserving stock.
- Keys of a gateway that has taken payments cannot be deleted, since refunds need them.

Shoppers do not choose between gateways at checkout: one is active at a time. The first gateway a
store connects starts taking payments at once, so connecting is one step. The Connect button opens
the gateway's keys page and our form together. It is not OAuth: that needs a partner agreement with
each gateway, and the platform has none.

**Cash on delivery** is a store setting beside the gateways, with an optional largest order. The
shopper chooses it at checkout when the order ships, is in the store's own currency and has no gift
card products. The order is OPEN and unpaid (`paymentProvider` `cod`), can be fulfilled, and becomes
a sale when the merchant records the cash, as a manual payment.

**DNS.** Connecting a domain never sells one. `GET /domains/:id/check` reads the records from public
resolvers (1.1.1.1 and 8.8.8.8, not the server's cache) and reports found, missing or wrong, plus the
DNS host recognised from the nameservers. Bare domains get an A record when `PLATFORM_APEX_IP` is set,
otherwise an ALIAS/ANAME. Records show the short host name that DNS dashboards ask for, based on a
small list of two-label public suffixes rather than the full Public Suffix List.

## Consequences

The adapters follow each gateway's published API and are tested against a fake HTTP layer. Each one
still needs a real test-mode rehearsal with that gateway's keys before going live.
