# Commerce Platform — multi-tenant ecommerce SaaS

An original Shopify-style platform: merchants sign up, create isolated stores, manage catalogs,
inventory, orders, customers, shipping, taxes, discounts, themes and custom domains; shoppers
browse host-routed storefronts, check out through a payment provider and track orders; platform
admins manage merchants, plans, subscriptions and usage limits.

Built on native Windows (PowerShell, no WSL/Docker required for development).

| App                  | Stack                                                                  | Dev URL                    |
| -------------------- | ---------------------------------------------------------------------- | -------------------------- |
| `apps/api`           | NestJS 12 REST API (`/api/v1`, OpenAPI at `/api/docs`)                 | http://localhost:4000      |
| `apps/admin`         | Next.js 16 merchant admin + `/platform` console                        | http://localhost:3100      |
| `apps/storefront`    | Next.js 16 storefront, routed by host name                             | http://demo.localhost:3200 |
| `packages/db`        | Prisma 7 schema, migrations (with RLS), tenant-scoped client           | —                          |
| `packages/contracts` | Zod schemas shared by API and apps (+ money, permissions, CSP helpers) | —                          |

## Getting started (PowerShell)

Requirements: Node.js 24 LTS, pnpm 10.34 (`npm install -g pnpm@10.34.7`), Git, and the portable
PostgreSQL 18 binaries in `D:\devtools\pgsql-18` (see ADR 0003).

```powershell
pnpm install
Copy-Item apps\api\.env.example apps\api\.env                     # then set STOREFRONT_SHARED_SECRET + APP_ENCRYPTION_KEY
Copy-Item apps\admin\.env.example apps\admin\.env.local
Copy-Item apps\storefront\.env.example apps\storefront\.env.local # same STOREFRONT_SHARED_SECRET
.\scripts\dev-db.ps1 init                                         # cluster, roles, shop_dev + shop_test, DB URLs into .env files
pnpm --filter @repo/db build
pnpm --filter @repo/db migrate:deploy
pnpm --filter @repo/api build; pnpm --filter @repo/api seed       # demo store + accounts
pnpm dev
```

Development accounts (seed): `merchant@example.com` / `merchant-password-123` (owner of store
**demo** → http://demo.localhost:3200) and `admin@example.com` / `admin-password-123` (platform
super-admin). Payments use the **sandbox provider** (no real money); emails are written to
`apps\api\storage\mailbox\`.

After a reboot: `.\scripts\dev-db.ps1 start`.

## Quality gates

| Command             | What it runs                                                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `pnpm check`        | ESLint (type-aware), TypeScript, Vitest (unit + API integration on a real Postgres test DB with RLS), production builds |
| `pnpm e2e`          | Builds, then Playwright browser tests (admin, storefront, checkout, accounts, settings, platform, 2FA, CSP)             |
| `pnpm format:check` | Prettier                                                                                                                |

Current status: **173 API tests, 29 contract tests, 26 browser tests — all passing.**

## Documentation

- [Architecture](docs/architecture.md) · [Roadmap](docs/roadmap.md) · [Data model](docs/data-model.md)
- [Tenant isolation](docs/tenant-isolation.md) · [Threat model](docs/threat-model.md) · [Security review](docs/security-review.md)
- [Deployment](docs/deployment.md) · [Runbook](docs/runbook.md) · [Performance](docs/performance.md)
- Decisions: [0001 stack](docs/adr/0001-technology-stack.md) · [0002 auth](docs/adr/0002-authentication.md) ·
  [0003 local infra & jobs](docs/adr/0003-local-infrastructure.md) · [0004 payments & orders](docs/adr/0004-payments-and-orders.md) ·
  [0005 billing & platform admin](docs/adr/0005-saas-billing-and-platform-admin.md)

## Security ground rules

- Tenant (store) identity is always derived server-side and enforced twice: application guards
  **and** PostgreSQL row-level security (see `docs/tenant-isolation.md`).
- No card data ever touches our servers (hosted payment pages; PCI SAQ-A).
- Never commit `.env` files or secrets; only `.env.example` files are tracked. Use sandbox/test
  credentials in development.
