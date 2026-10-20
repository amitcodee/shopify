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
| `APP_ENCRYPTION_KEY`          | Encrypts 2FA secrets: rotating requires re-encrypting `User.totpSecretEnc` (or asking users to re-enrol). Pending MFA challenges (5 min) become invalid. |
| `POSTMARK_SERVER_TOKEN`       | Create a new server token in Postmark, update `api.env`, restart API and worker, revoke the old token.                                                   |
| Stripe keys / webhook secrets | Roll in Stripe dashboard, update env, restart.                                                                                                           |
| Session tokens                | Disable a user from the platform console to revoke all their sessions.                                                                                   |

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
