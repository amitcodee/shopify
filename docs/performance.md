# Performance

## Load test (2026-10-19)

`node scripts/load-test.mjs demo.localhost:3200 10 20` against **one API process**
(`node dist/main.js`, jobs off) on the development machine (Windows 11, 16 GB RAM, PostgreSQL 18
on the same host), seeded demo store (8 products / 21 variants), 20 concurrent virtual users,
each request from a distinct shopper IP (realistic per-IP rate limits):

| Scenario                                      |  Throughput |     p50 |     p95 |      p99 | Errors |
| --------------------------------------------- | ----------: | ------: | ------: | -------: | -----: |
| Shop info                                     | 1,273 req/s | 14.6 ms | 23.4 ms |  31.5 ms |      0 |
| Product listing (price sort, SQL aggregation) |   942 req/s | 20.9 ms | 26.1 ms |  29.0 ms |      0 |
| Product page                                  |   814 req/s | 24.2 ms | 31.3 ms |  33.7 ms |      0 |
| Full-text search                              |   639 req/s | 25.8 ms | 65.5 ms | 133.9 ms |      0 |
| Cart create + add line (2 requests)           |   150 ops/s |  102 ms |  273 ms |   473 ms |      0 |

With a single client IP the per-IP limiter (300 req/min) correctly answered 429 — rate limiting
works; storefront traffic carries each shopper's IP via `X-Forwarded-For` (Next.js sets it, the API
trusts it only from `TRUST_PROXY`).

## What was tuned in Phase 8

- Indexes: `Order(storeId, customerId)`, `Order(storeId, paidAt)` (analytics),
  `CartLine(variantId)`, `Cart(expiresAt)`, `Session(expiresAt)`, GIN on `Product.tags`
  (tag collections); expression GIN index for full-text search (Phase 4).
- Daily cleanup of expired sessions/carts/tokens and old outbox/webhook rows keeps hot tables small.
- Store resolution is cached for 30 s per host.

## Tuning pass (2026-11-03)

Query times are `EXPLAIN ANALYZE` as the `shop_app` role, with row-level security on, against
20,000 temporary products in one store on the development machine. Page weights are compressed
transfer sizes in Chrome.

| Change                                                |      Before |      After |
| ----------------------------------------------------- | ----------: | ---------: |
| Search (stored `searchVector` column)                 |     ~400 ms |      27 ms |
| Listing, default sort, first page (index, page first) |      125 ms |     0.5 ms |
| JavaScript on pages without templates (`sideEffects`) |      204 KB |     155 KB |
| Repeat visits to `/media` photos                      | Revalidated | Cached 7 d |

- **Row-level security disables GIN indexes for the app role.** `@@` and `@>` are not leakproof,
  so PostgreSQL will not use them as index conditions under RLS: search took 398 ms as `shop_app`
  and 3.6 ms with RLS bypassed. Do not expect a GIN index to help a tenant query; check with
  `EXPLAIN` as `shop_app`. `enum_eq` is not leakproof either, so `status` columns in an index do
  not narrow tenant queries. `Product_tags_idx` has the same limit and was left in place.
- Deep pages (page 500 of 20,000 products) still sort the whole store, about 108 ms.
- The outbox no longer holds a transaction while sending. Claiming a message leases it for five
  minutes, so delivery is at-least-once: a worker dying mid-send causes a retry after the lease.
- `Product_storeId_listing_idx` is `NULLS LAST` in the database. Prisma cannot express that, so
  the schema declares it as plain `DESC`; `prisma migrate diff` stays empty.

## Known hot spots / next steps

1. **Cart writes** dominate latency: each request opens an interactive transaction (BEGIN,
   `set_config`, queries, COMMIT). Batching the cart read into the write path, or a
   non-interactive batch transaction, would roughly halve round trips.
2. **Storefront caching:** pages are rendered per request (required for the CSP nonce). Put a CDN
   in front of `/api/v1/media` and consider short-TTL caching of catalog API responses keyed by
   host (`StorefrontCatalogService`), invalidated on product writes.
3. **Horizontal scale:** API and storefront are stateless; run N instances behind the proxy.
   Rate limiting already uses shared PostgreSQL counters (one upsert per request); if that write
   shows up in profiles, move the counters to Redis or the proxy.
4. **Database:** use a connection pooler (PgBouncer in transaction mode works with the
   transaction-local `set_config`) when instance count grows.
