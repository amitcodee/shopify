# ADR 0007 — Multiple payment gateways and Razorpay

- Status: Accepted
- Date: 2026-10-20
- Extends: [ADR 0004](0004-payments-and-orders.md), [ADR 0006](0006-stripe-connect-payouts.md)

## Context

Stripe does not serve every market: merchants in India expect UPI, netbanking and INR payouts,
which Razorpay provides. Like Shopify, the platform should offer several gateways and let each
store pick one, without forking checkout, refunds, disputes or reporting per gateway.

## Decisions

**Gateways are configured, stores choose.** `PAYMENT_PROVIDERS` (e.g. `stripe,razorpay`; `mock`
in development) lists the gateways merchants can connect; the old single `PAYMENT_PROVIDER` is
still read. Each gateway is a pair of adapters behind the existing ports — `PaymentProvider`
(checkout, refunds, payment and dispute webhooks) and `ConnectProvider` (payout accounts,
account webhooks) — and a store's `PaymentAccount.provider` decides which pair its checkout,
refunds and webhooks use. A store has one account at a time; merchants can disconnect it
(audited) and connect another. An account whose gateway the platform stops offering cannot take
payments until the merchant switches.

**Onboarding styles.** `ConnectProvider` declares `hosted` (Stripe, sandbox: the provider's
pages) or `form` (Razorpay: details entered in our admin), the countries and store currencies it
supports, and whether it has a merchant dashboard. The admin shows a card per gateway and
disables gateways that cannot settle the store's currency.

**Razorpay checkout: Payment Links with Route transfers.** The shopper pays on a hosted Payment
Link (cards, UPI, netbanking, wallets; PCI SAQ-A like Stripe Checkout). The link's order carries
one Route transfer of the total minus the plan fee to the store's linked account
(`options.order.transfers`), so the fee stays on the platform account. `reference_id` is the
order id, which Razorpay keeps unique, so a retried request cannot create a second link. The
order is paid only from a verified `payment_link.paid` webhook, with the same amount check as
other gateways. Refunds pass `reverse_all` so the linked account returns its share, and carry an
idempotency key. `payment.dispute.*` events feed the shared dispute handling.

**Razorpay payouts: Route linked accounts.** Razorpay has no hosted onboarding for linked
accounts, so the owner enters legal name, business type, PAN, registered address and bank
account in the admin; the API validates them (PAN, IFSC, PIN, mobile formats) and passes them
straight to Razorpay: create account → stakeholder → request the Route product → submit
settlement details with terms accepted. Only the account id, the product configuration id
(`PaymentAccount.providerData`) and the status are stored; bank details are never stored and
are not echoed back into the form on errors. Activation arrives by `product.route.*` webhooks
(and can be re-read from the product configuration). Route settles INR only, so the gateway is
offered to INR stores.

**Webhooks.** Razorpay signs bodies with HMAC-SHA256 (`X-Razorpay-Signature`) and sends the
event id in `X-Razorpay-Event-Id`, which feeds the existing de-duplication. Payment and account
events go to the two existing endpoints (`/webhooks/payments/razorpay`,
`/webhooks/connect/razorpay`) as two Razorpay webhooks with the same secret.

**Status semantics.** For every gateway, `RESTRICTED` now means the provider needs something
from the merchant (requirements due or a disabled reason); submitted details awaiting review
stay `ONBOARDING` and show as "In review".

## Consequences

- No Razorpay SDK: a small fetch-based client keeps the dependency surface small and is
  injectable; adapter requests and webhook parsing are tested offline, and the full flow
  (onboarding → activation → checkout transfer → paid webhook → refund reversal → dispute) runs
  against an in-memory Razorpay in `razorpay.e2e`.
- The Razorpay request shapes follow its public API documentation and are not yet exercised
  against Razorpay's test mode from CI; do a test-mode rehearsal (keys `rzp_test_…`) before
  enabling it in production, as for Stripe.
- Razorpay linked accounts have no dashboard login to mint; settlements are emailed by Razorpay
  and the admin shows the platform's own 30-day summary.
