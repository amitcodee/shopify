# Deployment

## Topology

```
Internet ── Caddy (TLS, HTTP/2) ──┬── admin.<platform>   → admin (Next.js standalone)
                                  ├── api.<platform>     → api   (NestJS, RUN_JOBS=false) ×N
                                  └── every other host   → storefront (Next.js standalone) ×N
                         worker (same image as api: node dist/worker.js) ×1..N
                         PostgreSQL 18 (managed service recommended) + daily backups
```

- **Storefront hosts** (`<store>.<root domain>` and verified custom domains) get certificates
  **on demand**; Caddy asks `GET /api/v1/domains/tls-check?domain=…` first, so certificates are
  only issued for live stores.
- The **worker** runs the outbox (emails), unpaid-order expiry, subscription renewals and daily
  cleanup. Jobs are safe to run on several workers (row locks / idempotent transitions).
- Media is on a shared volume (`STORAGE_DIR`). For multiple API hosts, swap `LocalDiskStorage`
  for an S3-compatible adapter behind the `ObjectStorage` port and put a CDN in front.

Reference files: `Dockerfile` (targets `api`, `admin`, `storefront`, `migrate`),
`deploy/docker-compose.prod.yml`, `deploy/Caddyfile`, `deploy/postgres-init.sh`,
`deploy/env/*.env.example` (one file per service — least privilege: only `migrate` gets the
schema-owner credential, the Next.js apps get no database credentials), `.github/workflows/ci.yml`.

> Verification status: the standalone Next.js build and `pnpm deploy` bundle of the API were
> built and booted natively on Windows during Phase 8. The container images themselves were
> **not built locally** (Docker is not installed on the development machine); CI or a Docker
> host must build them before the first release.

## Release procedure

1. CI green on the commit (`pnpm check`, audit, Playwright).
2. Build images: `docker compose -f deploy/docker-compose.prod.yml build`.
3. **Backup** the database (see runbook) and confirm the dump verifies.
4. Run migrations: `docker compose … run --rm migrate`. Migrations are additive by policy;
   destructive changes need a two-step release (expand → migrate data → contract) and explicit
   approval.
5. Roll out `api`, `worker`, `admin`, `storefront`; health checks gate traffic
   (`/api/v1/health/ready`).
6. Smoke test: sign in to admin, open a storefront, run a sandbox checkout on a staging store.
7. Rollback: redeploy the previous images. Schema changes are backward compatible by policy;
   restore from backup only for data corruption.

## Production configuration checklist

The API refuses to start in production when:

- `PAYMENT_PROVIDER=mock` or `DNS_VERIFIER=mock`;
- `STOREFRONT_PROTOCOL` is not `https`, or `PUBLIC_API_URL` / `ADMIN_PUBLIC_URL` are not https;
- `STOREFRONT_SHARED_SECRET` / `APP_ENCRYPTION_KEY` are missing or shorter than 32 characters;
- Stripe is selected without `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and
  `STRIPE_CONNECT_WEBHOOK_SECRET`;
- `EMAIL_TRANSPORT` is `mailbox` (production needs `postmark` + `POSTMARK_SERVER_TOKEN`);
- any secret still contains a `CHANGE_ME` placeholder (in every environment).

Also verify by hand:

- [ ] Platform admins have 2FA enabled (`REQUIRE_PLATFORM_2FA` defaults to on in production).
- [ ] `TRUST_PROXY` matches the network your proxy runs in (so per-client rate limits work).
- [ ] Stripe webhooks point at `https://api.<platform>/api/v1/webhooks/payments/stripe` and
      `/api/v1/webhooks/billing`; test them with the Stripe CLI in test mode first.
- [ ] Rate limits are shared through PostgreSQL (`RATE_LIMIT_STORE=postgres`, the default), so
      they hold across API instances; keep `trust proxy` pointing at the real proxy so per-IP
      keys use the client address.
- [ ] Off-site backups and a restore drill are scheduled (runbook).
- [ ] Stripe Connect is enabled on the platform account (Express, platform-controlled fees and
      losses), branding is set for hosted onboarding, and a Connect webhook endpoint ("events on
      connected accounts": `account.updated`, `account.application.deauthorized`) points at
      `/api/v1/webhooks/connect/stripe` with its secret in `STRIPE_CONNECT_WEBHOOK_SECRET`
      (ADR 0006).
