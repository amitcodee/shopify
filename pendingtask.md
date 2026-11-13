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

## 2. Razorpay intro offer: cause found (2026-11-13)

Razorpay refuses an offer on any subscription with a future `start_at` (verified with the test API:
both `offer_TzYbMoF8joCz5s` and `offer_TzZyptQ2FlxDb4` are accepted without `start_at` and refused
with it). The UPI-only scope is not the cause.

The API now attaches the offer only when the subscription starts at once (trial over, or store
locked/expired). A merchant who subscribes during the trial gets the separate Rs 99 x 3 intro
mandate, then approves the Rs 799 mandate (a banner asks them).

To switch the offer on: set `BILLING_RAZORPAY_OFFER_ID=offer_TzYbMoF8joCz5s` in Coolify and
redeploy (currently `none`).

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

- Playwright `e2e/platform.spec.ts` + `e2e/cash-on-delivery.spec.ts`: run 2026-11-13, 3/3 pass.
- A full paid flow on staging (complete a test subscription in Checkout and confirm the first
  charge lands after the trial).

## 5. Rotate the Razorpay test key: new key made, Coolify not updated yet

Commit ce65fe4 pushed the test key id + secret in `prbl.md` to the public GitHub repo. The lines
are removed now, but they stay in git history. Razorpay Dashboard (Test mode) → Account & Settings
→ API Keys → Regenerate Test Key (done: new key id `rzp_test_TzZ59Ql9eDuGdY`, saved commented-out
in the gitignored `apps/api/.env`), then update `RAZORPAY_*` / `BILLING_RAZORPAY_*` in Coolify and
`apps/api/.env`, and redeploy.
