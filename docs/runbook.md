# Operations runbook

## Local development (native Windows)

| Task                        | Command (PowerShell, repo root)                                                  |
| --------------------------- | -------------------------------------------------------------------------------- |
| Start database after reboot | `.\scripts\dev-db.ps1 start`                                                     |
| Stop / status / SQL shell   | `.\scripts\dev-db.ps1 stop` · `status` · `psql`                                  |
| Run everything              | `pnpm dev` (API :4000, admin :3100, storefront :3200)                            |
| Apply migrations            | `pnpm --filter @repo/db migrate:deploy`                                          |
| Seed demo data              | `pnpm --filter @repo/api build; pnpm --filter @repo/api seed`                    |
| All checks                  | `pnpm check`                                                                     |
| Browser tests               | `pnpm e2e` (builds, then Playwright on ports 4100/3110/3210 against `shop_test`) |
| Read sent emails (dev)      | JSON files in `apps\api\storage\mailbox\`                                        |
| Load test                   | `node scripts/load-test.mjs demo.localhost:3200 15 20` (API must be running)     |

## Backups

- **Create:** `.\scripts\backup-db.ps1 -Database shop_dev [-OutDir D:\devtools\shopify-backups] [-Keep 14]`
  — custom-format `pg_dump`, verified with `pg_restore --list`, keeps the newest N.
- **Restore:** `.\scripts\restore-db.ps1 -File <dump> -Target <database>` — refuses to overwrite an
  existing database unless `-Replace` is given (destructive: drops the target first).
- **Production:** use the managed database's point-in-time recovery plus a nightly logical dump
  copied off-site (different account/region). Keep 30 daily + 12 monthly.
- **Drill (monthly):** restore the latest dump into a scratch database, compare row counts of
  `Store`, `Product`, `Order`, `AuditLog`, `_prisma_migrations` and the number of tables with forced
  RLS, then drop the scratch database. Last drill: 2026-10-19 — counts matched exactly
  (1/8/21/1/8 rows, 24 forced-RLS tables).

## Secrets and rotation

| Secret                        | Rotation impact                                                                                                                                          |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DB role passwords             | Update `DATABASE_URL*` and restart.                                                                                                                      |
| `STOREFRONT_SHARED_SECRET`    | Update API and storefront together. **Order-status links in old emails stop working** (they are HMACs of the order id).                                  |
| `APP_ENCRYPTION_KEY`          | Encrypts merchants' gateway keys, 2FA seeds, storefront passwords and webhook secrets. Rotate with the procedure below — never just replace it.          |
| Razorpay billing keys         | `BILLING_RAZORPAY_KEY_*`: roll in the Razorpay Dashboard, update `api.env`, restart API and worker. Plans are re-created under the new key on first use. |
| `POSTMARK_SERVER_TOKEN`       | Create a new server token in Postmark, update `api.env`, restart API and worker, revoke the old token.                                                   |
| Stripe keys / webhook secrets | Roll in Stripe dashboard, update env, restart.                                                                                                           |
| Session tokens                | Disable a user from the platform console to revoke all their sessions.                                                                                   |

### Rotating `APP_ENCRYPTION_KEY`

Replacing the key outright would make every connected payment gateway, 2FA device, storefront
password and webhook secret unreadable. Rotate in four steps:

1. Generate a new key: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.
2. In `api.env` set `APP_ENCRYPTION_KEY=<new>` and `APP_ENCRYPTION_KEYS_PREVIOUS=<old>`; restart API
   and worker. Old values still decrypt (keys are tried in order), new values use the new key.
3. Re-encrypt everything: `docker compose run --rm api node dist/rotate-encryption-key.js`. It
   prints counts per table and exits non-zero if any value could not be decrypted.
4. When it reports `failed: 0`, remove `APP_ENCRYPTION_KEYS_PREVIOUS` and restart. Keep the old
   key in the password manager for one backup cycle (old backups still need it).

The key also signs short-lived tokens (2FA challenges, theme previews): those issued before the
restart in step 2 stop working; users simply retry.

## Billing (merchant subscriptions)

- Plans live in Platform → Plans. Default: **Standard**, ₹799/month, 7-day free trial (no card),
  ₹99/month for the first 3 months. Prices include GST. A price change creates new Razorpay plans
  on first use; existing subscribers keep their mandate.
- Razorpay setup: `BILLING_PROVIDER=razorpay`, `BILLING_RAZORPAY_KEY_ID/SECRET`, and a webhook in
  the Razorpay Dashboard to `https://api.<domain>/api/v1/webhooks/billing/razorpay` with the
  `subscription.*` events and `BILLING_RAZORPAY_WEBHOOK_SECRET`. Enable Subscriptions and UPI
  AutoPay on the account.
- Intro price on one mandate (recommended): create an offer in Razorpay Dashboard → Subscriptions →
  Offers (flat ₹700 off, _limited number of cycles_ = 3) and paste its `offer_…` id into the plan.
  Without an offer, the intro months run on their own short mandate and the merchant authorises
  the ₹799 mandate when they end (they see a banner; 7 days of grace).
- The `billing` job (every 10 min) ends unpaid trials, re-syncs Razorpay subscriptions (so a missed
  webhook only delays an update) and sets `Store.billingLocked`. A locked store's storefront is
  offline and its admin shows only billing and data exports.
- Failed payment: Razorpay retries; the store keeps working for `BILLING_GRACE_DAYS` (7), then locks.
- Comp a store: Platform → Stores → set plan (provider `manual`, never charged, never locks).

## Closed stores

An owner can close a store (Settings → General). The storefront goes offline at once, the
subscription is cancelled, and the `erase-closed-stores` job deletes the store and its media 30
days later (`Store.deletionScheduledAt`). Platform invoices are kept for tax records. To stop an
erasure (e.g. legal hold), set `deletionScheduledAt` to NULL for that store.

## Incident playbooks

**Suspicious store (fraud, abuse):** Platform → Stores → _Suspend_ with a reason. The storefront goes
offline within 30 s (resolver cache) and the merchant admin is locked. Everything is in the
platform audit log.

**Locked-out user:** 10 failed sign-ins lock an account for 15 minutes and it unlocks by
itself. To unlock early (after confirming identity): `UPDATE "User" SET "lockedUntil" = NULL,
"failedLoginCount" = 0 WHERE email = '…';`

**Compromised staff account:** Platform → Users → _Disable_ (revokes all sessions). The store owner
removes the member under Settings → Staff. Review the store's audit log for the period.

**Payment webhook failures:** webhook processing failures are retried by the provider (the event
row is removed when processing fails). Check API logs by `X-Request-Id`; `WebhookEvent` shows what
was processed. Unpaid orders auto-cancel after `ORDER_PAYMENT_TIMEOUT_MINUTES` and release stock.

**Emails not sending:** inspect `OutboxMessage` (`status`, `attempts`, `lastError`). Messages retry
with exponential backoff up to 5 times, then become `FAILED`; reset `status='PENDING'` to retry.

**Customer data request:** Admin → Customers → customer → _Download customer data_ (access) or
_Redact personal data_ (erasure; orders are kept anonymised for accounting).

## Monitoring

- Liveness `GET /api/v1/health`, readiness `GET /api/v1/health/ready` (database).
- Logs: JSON lines in production with request ids; 5xx responses return `Reference: <request id>`.
- Alert on: readiness failures, 5xx rate, `OutboxMessage` FAILED count, webhook errors, p95 latency.
