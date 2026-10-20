# ADR 0006 — Merchant payouts with Stripe Connect

- Status: Accepted
- Date: 2026-10-20
- Supersedes: the "platform-level Stripe account" limitation in ADR 0004

## Context

Until now every sale was charged on the platform's own Stripe account, so merchants could not be
paid out and real merchants could not be onboarded. Like Shopify Payments, the platform must
settle each store's sales to that store's bank account and keep its plan's transaction fee.

## Decisions

**Connected accounts: one per store, Express dashboard, platform-created.** A store owner picks
the business country and is sent to Stripe's hosted onboarding (`account_onboarding` account
link); identity documents and bank details never touch our servers. Accounts are created with
`controller.stripe_dashboard = express`, `fees.payer = application` and
`losses.payments = application`: the platform pays Stripe's processing fees (recovered through
the plan fee) and is liable for negative balances, which is what lets it offer one simple price
and keep checkout consistent. `PaymentAccount` stores only the account id and its status flags.

**Charges: destination charges with `on_behalf_of`.** Checkout Sessions stay on the platform
account (so the existing webhook endpoint, amount checks and order logic are unchanged), with
`transfer_data.destination` = the store's account, `on_behalf_of` the same account (the merchant
is the settlement merchant, their statement descriptor and country apply), and
`application_fee_amount` = the plan's `transactionFeeBps` of the total, rounded half up and
recorded on `Payment.applicationFee` (a CHECK keeps it between 0 and the amount). Refunds use
`reverse_transfer` + `refund_application_fee`, so the merchant and the platform give back their
shares proportionally.

**Checkout is gated on the account.** A paid order can only be placed when the store's account
is `ACTIVE` with `charges_enabled` for the active provider; otherwise checkout returns 409
_before_ any stock is reserved, the storefront shows "not accepting payments yet", and the admin
home shows a setup banner. The account is re-checked when the payment session opens (resumed
checkouts) because it can change in between.

**Status comes from Stripe.** A separate Connect webhook endpoint
(`/webhooks/connect/stripe`, its own signing secret) handles `account.updated` (flags,
requirements, disabled reason) and `account.application.deauthorized` (→ `DISCONNECTED`, never
revived by a later update; reconnecting creates a new account). Events are verified and
de-duplicated exactly like payment webhooks, in their own `WebhookEvent` namespace. When the
merchant returns from onboarding the admin also re-reads the account, so the page is correct
even before the webhook arrives. Status: `ACTIVE` once charges are enabled, `RESTRICTED` after
details were submitted but charges are disabled, otherwise `ONBOARDING`.

**Who can do what.** Viewing the Payments page needs `settings:read`; creating the account,
onboarding links and the Express dashboard login link need `billing:manage` (owners): payouts go
to the owner's bank account. `PaymentAccount` is a tenant table with forced RLS.

**Sandbox.** `MockConnectProvider` mirrors the flow without Stripe: onboarding is a sandbox page
in the admin whose outcome (complete / missing bank details) arrives as an HMAC-signed Connect
webhook through the same verification, de-duplication and status code. Its signing key is
domain-separated from the mock payment webhook key, so one cannot be replayed as the other. It is
refused in production, like the mock payment provider.

**Reporting.** The Payments page shows a 30-day summary from our own records (gross, platform
fees, refunds, net) and Stripe's latest payouts for the account; the platform console shows fee
revenue per currency and how many stores can accept payments.

## Consequences

- Production needs `STRIPE_CONNECT_WEBHOOK_SECRET` (the API refuses to start without it when
  `PAYMENT_PROVIDER=stripe`) and Connect enabled on the platform's Stripe account.
- The platform carries dispute and negative-balance risk for connected accounts. Disputes are
  not yet surfaced in the admin (next step: `charge.dispute.*` webhooks → order timeline).
- Payment rows created before this change have `destinationAccountId = null` and are refunded
  without transfer reversal.
