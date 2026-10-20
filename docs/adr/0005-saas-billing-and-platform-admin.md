# ADR 0005 — SaaS plans, billing, usage limits and platform administration

- Status: Accepted
- Date: 2026-10-19

## Decisions

**Plans** (`Plan`) carry limits — products, staff accounts (members + pending invitations),
orders per calendar month (UTC) — and an informational platform fee. Default plans (Starter /
Growth / Pro) are created idempotently when the table is empty. Every store gets a
`Subscription` at creation (default plan, 14-day trial).

**Limits are enforced server-side inside the same transaction as the write** (`PlanLimits`):
product creation, staff invitations, and checkout (monthly order cap). Violations return
**HTTP 402** with a human-readable reason. Downgrades are refused while usage exceeds the target
plan.

**Billing** goes through a `BillingProvider` port:

- `mock` (development/tests): plan changes take effect immediately and create a paid invoice;
  an hourly job renews due periods, ends trials and applies scheduled downgrades.
- `stripe`: Stripe Checkout in `subscription` mode; activation, renewals (`invoice.paid`) and
  cancellations (`customer.subscription.deleted`, downgrade to the default plan) arrive through
  the signed `/webhooks/billing` endpoint, de-duplicated via `WebhookEvent`.

**Platform administration** lives under `/api/v1/platform`, guarded by `PlatformAdminGuard`
(`SUPER_ADMIN` full access, `SUPPORT` read-only). It deliberately uses the `BYPASSRLS`
connection for cross-tenant reporting (MRR, GMV, usage), and every mutation is written to
`PlatformAuditLog`, which is append-only for both application roles. Admin capabilities:
suspend/reactivate stores (storefront goes offline, merchant admin is locked), comp a store onto
a plan, manage plans, disable/enable users (revoking their sessions), close sign-ups, and a
notice shown to all merchants.

## Consequences

- Stripe subscription billing and Stripe Checkout payments share the platform Stripe account;
  merchant payouts still need Stripe Connect (ADR 0004).
- Proration and mid-period upgrades are simplified (a new 30-day period starts at the change).
