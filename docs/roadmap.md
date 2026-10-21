# Roadmap

Each phase ends with: lint, type check, tests, build all green; docs/threat model updated; demo of the working slice.

## Phase 1 — Foundation ✅

- Monorepo (pnpm workspaces + Turborepo), shared TS/ESLint configs, Prettier, EditorConfig, line-ending rules for Windows.
- `apps/api` (NestJS): `/api/v1/health`, helmet, CORS allowlist, env validation, OpenAPI at `/api/docs`, unit + HTTP integration tests.
- `apps/admin`, `apps/storefront` (Next.js + Tailwind): landing pages showing live API health.
- `packages/contracts`: shared Zod schemas.
- Architecture, data model, tenant isolation, threat model docs.
- **Exit criteria:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` pass on Windows; `pnpm dev` serves all three apps.

## Phase 2 — Database, auth, onboarding, tenant isolation ✅

- Portable PostgreSQL 18 via `scripts/dev-db.ps1` (ADR 0003); first-party sessions (ADR 0002).
- `packages/db`: Prisma 7 schema (platform + store & access tables), first migration, seed.
- Sign-up/sign-in/sign-out, Argon2id, hashed session tokens, rate limits. Email verification moves to Phase 5.
- Merchant onboarding: create merchant + first store + subdomain.
- TenantContext, guards, tenant-scoped Prisma extension, RLS policies, audit log.
- Cross-tenant isolation integration tests.

## Phase 3 — Merchant dashboard: settings, products, variants, inventory ✅

- Products with up to 3 options and a variant matrix, SKUs unique per store, plain-text descriptions (no merchant HTML).
- Images: decoded + re-encoded to WebP with sharp (strips metadata, rejects SVG), served from `/api/v1/media` with a sandbox CSP.
- Inventory: append-only ledger, row-locked adjustments, no negative stock unless backorders are allowed.
- Collections: manual or automated by tag. Staff: invitations (hashed single-use tokens), roles and permissions.
- Composite `(storeId, id)` foreign keys + forced RLS on every catalog table; cross-tenant tests for each route.

## Phase 4 — Storefront: host routing, product pages, collections, search, cart ✅

- Host routing: `<subdomain>.<root domain>`; the storefront server signs the shopper's host (HMAC-SHA256, 5-minute window) and the API resolves the store from it — never from client input.
- Catalog pages, collections (manual + tag), sorting, pagination, JSON-LD, PostgreSQL full-text prefix search (expression GIN index).
- Database carts: token in an HttpOnly cookie, only its hash stored; prices and stock re-evaluated on every read; stock-aware add/update.
- Playwright E2E for admin and storefront flows.

## Phase 5 — Checkout, payment sandbox, orders, refunds, notifications ✅

- Checkout with server-side pricing, atomic stock reservation, idempotency keys, superseded/expired order release (ADR 0004).
- PaymentProvider port: mock sandbox (signed webhooks) and Stripe Checkout; webhook verification + de-duplication + amount checks.
- Admin orders (fulfil with tracking, partial/full refunds with restock, cancel), customers, analytics dashboard.
- Storefront checkout, sandbox payment page, order-status page, customer accounts (activation for guest emails, password reset).
- Transactional outbox + worker for emails (ADR 0003: Postgres instead of Redis/BullMQ).

## Phase 6 — Themes, custom domains, shipping, taxes, discount codes ✅

- Themes: 3 layout presets + validated, data-only settings (hex colors, font enum, short text) applied as CSS variables — no merchant HTML/CSS/JS.
- Custom domains: DNS TXT ownership verification (system DNS in production, mock in dev), primary domain for emails, resolver routing, one-primary partial unique index.
- Shipping zones (country / rest-of-world precedence) with price, subtotal and weight conditions; free fallback until configured.
- Tax rates per country with region overrides, optional tax on shipping.
- Discount codes: percentage, fixed, free shipping; schedule, minimums, atomic usage limits (since Phase 8: counted when the order is paid).

## Phase 7 — Platform admin, plans, subscriptions, billing, usage limits ✅

- Plans with product/staff/monthly-order limits enforced transactionally (HTTP 402), downgrade guard (ADR 0005).
- Subscriptions per store (trial on creation), mock billing with invoices + renewal job, Stripe Billing adapter.
- Merchant Plan & billing page with usage meters and invoices.
- Platform console: overview (MRR, GMV, plan breakdown), stores (suspend/reactivate, comp plan), plans, users (disable), settings (sign-ups, notice), append-only platform audit log.

## Phase 8 — Security review, test hardening, performance, backups, deployment ✅

- Security review with 12 findings fixed and regression-tested ([security-review.md](security-review.md)): in-store privilege escalation guard, email-only invitation links, paid-only quotas and discount redemption, domain squatting fix, account lockout, per-service deployment secrets, production email adapter, safer redirects.
- TOTP 2FA (mandatory for platform admins in production), nonce-based CSP, request IDs and JSON logs, customer data export/redaction, on-demand TLS ask endpoint, retention cleanup job.
- Performance: indexes for hot queries, load test with recorded results ([performance.md](performance.md)).
- Backups: verified `pg_dump` script, guarded restore script, restore drill recorded in the runbook.
- Deployment: multi-stage Dockerfile, production compose + Caddy (on-demand TLS), CI workflow, release procedure ([deployment.md](deployment.md)).

## Post-v1 follow-ups

- ✅ Merchant sign-up email verification (2026-10-20): signed 24-hour link, required before creating a store.
- ✅ Stripe Connect payouts (2026-10-20): Express accounts, destination charges with platform fees, Payments settings page ([ADR 0006](adr/0006-stripe-connect-payouts.md)).
- ✅ Shared rate limits (2026-10-20): PostgreSQL counters, so limits hold across API instances.
- ✅ Account recovery (2026-10-20): emailed unlock links on lockout, merchant forgot/reset password.
- ✅ Chargebacks (2026-10-20): provider dispute webhooks mirrored to orders, store emails, admin views.
- ✅ Multiple gateways + Razorpay (2026-10-20): per-store gateway choice; Razorpay Payment Links + Route payouts ([ADR 0007](adr/0007-payment-gateways-razorpay.md)).
- ✅ Release hardening (2026-10-21): CI builds and boots the production images; dependency audit clean at `high`.
- ✅ Online store content (2026-10-21): pages, store policies (footer + checkout links), main/footer navigation menus with typed links.
- ✅ Abandoned checkout recovery (2026-10-21): one email after a store-chosen delay with a signed link that rebuilds the cart; admin list with recovered orders.
- ✅ Draft orders (2026-10-21): merchant-built orders with catalog or custom items, custom prices, discount and shipping; emailed invoices paid on the storefront, or marked as paid (manual payment, refunds recorded only).
- ✅ SEO basics (2026-10-21): per-store `sitemap.xml` (active products, published collections/pages, policies) and `robots.txt`.
- ✅ Gift cards (2026-10-21): merchant-issued codes (shown once, keyed hash stored), redeemed at checkout for part or all of an order, restored when unpaid orders expire, credited back by refunds; balance history and adjustments.
- ✅ Product CSV import/export (2026-10-21): Shopify-style columns, one row per variant; import creates new products through the normal validation and plan limits, skips existing handles and reports problems by row.
- ✅ Developer platform (2026-10-21): store-scoped Admin API access tokens and signed outbound webhooks with retries and SSRF protection ([ADR 0008](adr/0008-developer-platform.md)).
- ✅ Storefront password page (2026-10-21): pre-launch stores require a password; the API itself refuses catalog, cart and checkout without the access token.
- ✅ Blog (2026-10-21): posts with drafts, scheduled publishing, authors, excerpts and tags at `/blog`; menu link type and sitemap entries.
- ✅ Gift card products (2026-10-21): products flagged as gift cards (variants = denominations) issue and email one card per unit when paid; never discounted, shipped, taxed or stock-tracked, and not payable with gift cards.
