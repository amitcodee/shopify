# Architecture

Multi-tenant ecommerce SaaS: many merchants, each running one or more isolated stores, served from a single shared platform.

## 1. System context

```
                ┌──────────────────────┐          ┌──────────────────────┐
 Shoppers ────▶ │  apps/storefront     │          │  apps/admin          │ ◀──── Merchants / staff
 (store.example │  Next.js, host-routed│          │  Next.js, merchant   │ ◀──── Platform super-admins
  .com or *.    │  SSR/ISR, public     │          │  dashboard + /platform│
  platform.app) └──────────┬───────────┘          └──────────┬───────────┘
                           │  REST /api/v1 (JSON)             │
                           ▼                                  ▼
                ┌─────────────────────────────────────────────────────────┐
                │ apps/api — NestJS modular monolith                       │
                │  auth · tenancy · catalog · inventory · cart · checkout │
                │  orders · customers · shipping · tax · discounts        │
                │  themes · domains · billing · platform-admin · audit    │
                │  adapters: payments · email · storage · dns             │
                └───────┬──────────────────────┬───────────────┬──────────┘
                        │                      │               │
                 ┌──────▼──────┐        ┌──────▼─────┐  ┌──────▼──────────────┐
                 │ PostgreSQL  │        │ Redis      │  │ External providers   │
                 │ (Prisma,RLS)│        │ cache +    │  │ Stripe (sandbox),    │
                 └─────────────┘        │ BullMQ jobs│  │ email, S3-compatible │
                                        └────────────┘  └──────────────────────┘
```

### Why a modular monolith (not microservices)

One deployable API with strict internal module boundaries. It keeps transactions simple (orders + inventory + payments in one DB transaction), keeps local development on Windows lightweight, and can be split later along module seams if load demands it. Background work (emails, webhooks, image processing) runs in a separate **worker** process from the same codebase via BullMQ, introduced in Phase 5.

### Why two frontend apps

- **storefront** is public, cache-heavy, host-routed (subdomain/custom domain → store). It must never ship merchant-admin code or cookies.
- **admin** serves the merchant dashboard and, under `/platform`, the super-admin console (separate role, separate audit trail). Runs on its own origin, so admin session cookies are never sent to storefront domains.

## 2. Repository layout

```
apps/
  api/          NestJS REST API (port 4000) — /api/v1, OpenAPI at /api/docs
  admin/        Next.js merchant + platform admin (port 3100)
  storefront/   Next.js customer storefront (port 3200)
packages/
  contracts/    Zod schemas + TS types shared by API and frontends (request/response contracts)
  tsconfig/     Shared TypeScript configs
  eslint-config/Shared ESLint flat configs
  db/           (Phase 2) Prisma schema, migrations, tenant-scoped client
docs/           Architecture, roadmap, data model, tenant isolation, threat model, ADRs
```

## 3. Backend module design

Each NestJS feature module owns: controller (HTTP only) → service (business logic, reusable) → repository (data access, always tenant-scoped). Controllers never touch Prisma directly. Cross-module calls go through exported services, not repositories.

Cross-cutting pieces:

- **TenantContext** — resolved once per request (from session membership for admin, from Host header for storefront) and stored in `AsyncLocalStorage`. See `tenant-isolation.md`.
- **Guards** — `AuthGuard` (session) → `StoreAccessGuard` (membership in the target store) → `PermissionGuard` (role permission such as `products:write`).
- **Validation** — every request body/query is parsed with a Zod schema from `@repo/contracts`; unknown keys rejected.
- **Audit log** — mutating admin actions emit an audit event (actor, store, action, target, before/after diff, IP, user agent).
- **Adapters** (ports & adapters) — `PaymentProvider`, `EmailSender`, `ObjectStorage`, `DnsVerifier` interfaces with sandbox/mock implementations for local dev and real ones selected by config.

## 4. API conventions

- Base path `/api/v1`. JSON only. OpenAPI document generated from controllers.
- Admin routes: `/api/v1/admin/stores/:storeId/...` — `storeId` is a _request_, authorized against the session's memberships on every call.
- Storefront routes: `/api/v1/storefront/...` — store resolved from the `Host` (forwarded by the storefront app via a signed header), never from the body.
- Platform routes: `/api/v1/platform/...` — super-admin only.
- Money as integer minor units + ISO-4217 currency. IDs are UUIDs. Timestamps are UTC ISO-8601.
- Mutations that may be retried (checkout, payments, refunds) require an `Idempotency-Key` header.
- Errors: RFC 9457 problem+json shape.

## 5. Local development (native Windows)

- Node.js 24 LTS, pnpm 10 (pinned via `packageManager`), Turborepo for task orchestration.
- PostgreSQL and Redis: installed natively or via Docker Desktop — decided before Phase 2 (see roadmap).
- Payments: Stripe test mode only. Email: captured locally (mock adapter / Mailpit). Storage: local filesystem adapter.

## 6. Decisions log

See `docs/adr/`.
