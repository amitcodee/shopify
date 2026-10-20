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
