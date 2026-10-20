# Tenant isolation strategy

**Model:** shared database, shared schema, every tenant-owned row carries `store_id`. Isolation is enforced in three independent layers so that a bug in one layer does not leak data.

## Layer 1 — Request: who is the tenant?

The tenant is **derived by the server**, never accepted on trust.

| Surface                              | Source of tenant                                                            | Check                                                                                                                                                                                 |
| ------------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin API `/admin/stores/:storeId/*` | URL param is only a _request_                                               | `StoreAccessGuard` loads `StoreMember(userId, storeId)` for the session user; missing → `404` (not `403`, to avoid store enumeration). Role permissions checked by `PermissionGuard`. |
| Storefront API `/storefront/*`       | `Host` header → `Domain` table (verified domains + `*.platform` subdomains) | Storefront app forwards the original host in a header signed with an HMAC shared secret; API rejects unsigned/invalid values. Unknown or unverified host → `404`.                     |
| Platform API `/platform/*`           | No tenant; super-admin role                                                 | `PlatformAdminGuard`; every action audited.                                                                                                                                           |
| Background jobs                      | `storeId` in job payload, set by server code only                           | Worker re-establishes TenantContext before running.                                                                                                                                   |

Body/query fields named `storeId` are **ignored** by tenant-scoped endpoints.

## Layer 2 — Application: every query is scoped

- `StoreAccessGuard` produces an explicit `StoreContext` (`{ id, role, permissions, currency }`)
  that controllers pass to services as the first argument. (Explicit parameters were chosen over
  `AsyncLocalStorage` so the tenant is visible at every call site and in tests.)
- Tenant tables are only reachable through `TenantDb.run(storeId, tx => …)` (`withTenant` in
  `@repo/db`), which opens a transaction and sets `app.store_id` first. Outside it, tenant tables
  return **no rows** (fail closed).
- Lookups by ID always use `{ id, storeId }`, never `{ id }` alone.
- Test guard: integration tests call store-scoped endpoints as a member of store A against store
  B's IDs and expect `404`; a schema test asserts every table with a `storeId` column (except the
  global `StoreMember`) has RLS enabled **and forced**.

## Layer 3 — Database: PostgreSQL Row-Level Security (defense in depth)

- Every tenant table: `ALTER TABLE … ENABLE ROW LEVEL SECURITY; FORCE ROW LEVEL SECURITY;` with policy `store_id = current_setting('app.store_id', true)::uuid`.
- The API connects as `app_user` (no `BYPASSRLS`, not table owner). Migrations run as a separate `app_migrator` role.
- Each tenant-scoped transaction begins with `SELECT set_config('app.store_id', $1, true)` (transaction-local, safe with connection pooling).
- Platform-admin and cross-tenant jobs (billing aggregation) use a dedicated role/connection, used only from the platform module, with audit logging.
- **Composite foreign keys** `(store_id, id)` between tenant tables so a row in store A can never reference a row in store B (e.g. an order line pointing at another store's variant).
- Unique constraints are per-tenant: `UNIQUE (store_id, handle)`, `UNIQUE (store_id, sku)`.

## Other isolation concerns

- **Caching:** every cache key is prefixed `store:{storeId}:`. Storefront CDN cache varies by host.
- **Files:** object keys are `stores/{storeId}/…`; signed URLs only.
- **Rate limits & usage limits:** per store and per IP, so one tenant cannot starve others.
- **Search:** Postgres full-text search queries always include `store_id`; any future external search index uses per-store filtering enforced server-side.
- **Logs/metrics:** include `storeId` for tracing; never log secrets or full customer PII.
