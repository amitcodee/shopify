# Pending tasks

Updated 2026-11-12. Staging is live on Coolify (200.234.38.152:8000 → Student Projects →
production → resource `shopify:master-…`, compose `deploy/docker-compose.coolify.yml`).

| What | URL |
| --- | --- |
| Marketing + pricing | https://shop.200.234.38.152.sslip.io/pricing |
| Demo store | https://demo.shop.200.234.38.152.sslip.io |
| Merchant admin | https://admin.shop.200.234.38.152.sslip.io |
| API health | https://api.shop.200.234.38.152.sslip.io/api/v1/health/ready |

Logins: `merchant@example.com` and `admin@example.com`. Passwords are the `SEED_MERCHANT_PASSWORD`
and `SEED_ADMIN_PASSWORD` values in Coolify → resource → Environment Variables.

## 1. Razorpay webhook (Test mode)

Razorpay Dashboard → Payments → Account & Settings → Webhooks → Add New Webhook:

- URL: `https://api.shop.200.234.38.152.sslip.io/api/v1/webhooks/billing/razorpay`
- Secret: the value of `BILLING_RAZORPAY_WEBHOOK_SECRET` in Coolify Environment Variables
- Events: every `subscription.*` event (authenticated, activated, charged, pending, halted,
  cancelled, completed, paused, resumed, updated)

Without it, billing still works: the `billing` job re-syncs every 10 minutes.

## 2. Razorpay intro offer (₹99 for 3 months on one mandate)

Razorpay Dashboard → Offers → Create Offer → Subscriptions:

- Discount: flat ₹700 (₹799 → ₹99)
- Redemption type: "Limited number of cycles" = 3
- Payment methods: UPI and Card

Copy the `offer_…` id into admin → Platform → Plans → Standard → "Razorpay offer id" and save.
Without an offer, the intro months run on their own mandate and the merchant re-authorises the
₹799 mandate when they end (a banner asks them to).

## 3. Before real launch

- Own domain instead of sslip.io: point `admin.`, `api.`, the root and store subdomains (or a
  wildcard) at 200.234.38.152, then update `ROOT_DOMAIN` and the Domains page in Coolify.
- Real email: set `APP_STAGE=production`, `EMAIL_TRANSPORT=postmark`, `POSTMARK_SERVER_TOKEN`.
  Until then emails (verification, COD confirmation) only land in the API's `storage/mailbox`.
- Live Razorpay keys (`BILLING_RAZORPAY_*`, `RAZORPAY_*`) and a live-mode webhook + offer.
- Optional: `SENTRY_DSN`; S3/R2 media (`STORAGE_DRIVER=s3`, see docs/deployment.md); managed
  Postgres.
- Security: `prbl.md` contains the Razorpay test secret. Never commit it; rotate the test key in
  the Dashboard if it was ever shared.

## 4. Not yet run

- Playwright browser tests (`e2e/platform.spec.ts`, `e2e/cash-on-delivery.spec.ts` were updated
  for the new plan and COD confirmation but not run).
- A full paid flow on staging (complete a test subscription in Checkout and confirm the first
  charge lands after the trial).
