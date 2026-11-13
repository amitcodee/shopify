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

> Verification: the CI `images` job (`scripts/ci-compose-smoke.sh`) builds every image and boots
> this compose topology (without Caddy) with throwaway secrets on each push: migrations apply,
> `/api/v1/health/ready` passes, the worker's heartbeat health check passes, both Next.js apps
> render, and the media volume is writable by the `node` user. Docker is not installed on the
> development machine, so this job is the only place the images are built. Check it is green
> before a release.

## Release procedure

1. CI green on the commit (`pnpm check`, audit, Playwright, production image smoke test).
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

- `PAYMENT_PROVIDERS` includes `mock`, or `DNS_VERIFIER=mock`;
- `STOREFRONT_PROTOCOL` is not `https`, or `PUBLIC_API_URL` / `ADMIN_PUBLIC_URL` are not https;
- `STOREFRONT_SHARED_SECRET` / `APP_ENCRYPTION_KEY` are missing or shorter than 32 characters;
- Stripe is selected without `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and
  `STRIPE_CONNECT_WEBHOOK_SECRET`;
- Razorpay is selected without `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and
  `RAZORPAY_WEBHOOK_SECRET`;
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
- [ ] Razorpay (if offered): Route is enabled on the platform account, live keys are set, and two
      webhooks point at `/api/v1/webhooks/payments/razorpay` (`payment_link.paid`,
      `payment_link.expired`, `payment_link.cancelled`, `payment.dispute.*`) and
      `/api/v1/webhooks/connect/razorpay` (`product.route.*`, `account.suspended`), both signed
      with `RAZORPAY_WEBHOOK_SECRET` (ADR 0007).

## Scaling past one server

The reference compose file runs everything on one host, so that host is a single point of
failure. Before real merchants depend on it:

1. **Managed PostgreSQL** (AWS RDS, DigitalOcean, Neon, Supabase…) with automated backups and a
   standby. Create the three roles from `deploy/postgres-init.sh` there, point `DATABASE_URL`,
   `DATABASE_URL_PLATFORM` and `DATABASE_URL_MIGRATE` at it, and drop the `postgres` service.
2. **Object storage + CDN** for media: `STORAGE_DRIVER=s3` with `S3_BUCKET`, `S3_REGION`,
   `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (and `S3_ENDPOINT` for Cloudflare R2 /
   DigitalOcean Spaces / MinIO). Put a CDN on the bucket and set `MEDIA_PUBLIC_URL` to it, and
   the same value on admin and storefront (their CSP allows it). Copy existing files with
   `aws s3 sync /app/storage/stores s3://<bucket>/stores`.
3. **More app servers**: with the two steps above the API, admin and storefront are stateless
   (rate limits live in PostgreSQL), so run them on two or more hosts behind a load balancer. Run
   exactly one `worker` (its jobs are safe to overlap, but one is enough).
4. **Error reporting**: set `SENTRY_DSN` (and `SENTRY_ENVIRONMENT`) on the API and worker. 5xx
   errors and failed background jobs are reported; request bodies, headers and cookies are not
   sent. Pair it with an uptime check on `https://api.<domain>/api/v1/health/ready`.

## Coolify (staging or small production)

`deploy/docker-compose.coolify.yml` runs on [Coolify](https://coolify.io) with its Traefik proxy
instead of Caddy:

1. New resource → Public/Private repository → build pack **Docker Compose**, compose file
   `deploy/docker-compose.coolify.yml`.
2. Environment variables: `ROOT_DOMAIN` (e.g. `shop.203.0.113.10.sslip.io` for a test server),
   `BILLING_RAZORPAY_KEY_ID`, `BILLING_RAZORPAY_KEY_SECRET`, `BILLING_RAZORPAY_WEBHOOK_SECRET`,
   `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, and for the demo seed
   `SEED_ADMIN_PASSWORD`, `SEED_MERCHANT_PASSWORD`. Optional `BILLING_RAZORPAY_OFFER_ID` (the
   Dashboard offer for the intro price) is saved on every intro plan at start-up. Razorpay needs
   discount ≤ the offer's minimum amount < plan price, e.g. ₹700 off, minimum ₹750, plan ₹799.
   Database passwords and app secrets are
   generated by Coolify (`SERVICE_PASSWORD_*`, `SERVICE_BASE64_*`).
3. Domains: admin `https://admin.<root>:3000`, api `https://api.<root>:4000`, storefront
   `https://<root>:3000,https://demo.<root>:3000` (one entry per store host; custom domains are
   added the same way).
4. Deploy, then seed demo data once from the API container's terminal: `node dist/seed.js`.

`APP_STAGE=staging` (the default in that file) keeps emails in the API's `storage/mailbox` folder
instead of Postmark. For production set `APP_STAGE=production`, `EMAIL_TRANSPORT=postmark` and
`POSTMARK_SERVER_TOKEN`, and live Razorpay keys.
