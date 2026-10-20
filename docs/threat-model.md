# Threat model (v0)

Method: STRIDE over the main assets and trust boundaries. Revisit at the end of every phase.

**Assets:** customer PII and orders, merchant catalog and revenue data, staff/admin accounts, payment provider credentials, platform super-admin access, store domains/reputation.

**Trust boundaries:** browser ↔ storefront/admin apps; apps ↔ API; API ↔ PostgreSQL/Redis; API ↔ third-party providers (payments, email, DNS, storage); inbound webhooks; merchant-authored content rendered to shoppers.

| #   | Threat (STRIDE)                          | Example                                                                              | Mitigations                                                                                                                                                                                    |
| --- | ---------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | Cross-tenant access (I, E)               | Staff of store A reads/edits store B's orders by changing `:storeId` or an entity ID | Server-derived tenant; `StoreAccessGuard`; `{id, storeId}` lookups; Prisma tenant extension; Postgres RLS; composite FKs; cross-tenant integration tests                                       |
| T2  | Privilege escalation inside a store (E)  | STAFF grants themselves OWNER; changes payout settings                               | Permission matrix enforced server-side; only OWNER manages members/billing; audit log; re-auth for sensitive actions                                                                           |
| T3  | Account takeover (S)                     | Credential stuffing, session theft                                                   | Argon2id hashing (via auth library), rate limiting + lockout, email verification, optional TOTP 2FA for staff (mandatory for super-admins), HttpOnly+Secure+SameSite cookies, session rotation |
| T4  | CSRF (T)                                 | Malicious site triggers admin mutation                                               | SameSite=Lax/Strict cookies, Origin header checks, CSRF token for cookie-authenticated mutations, CORS allowlist                                                                               |
| T5  | XSS via merchant content / themes (T, E) | Product description or theme setting injects script into storefront                  | Sanitize rich text on write (allowlist), themes are data + fixed templates (no merchant JS in v1), strict CSP with nonces, React escaping                                                      |
| T6  | Host header / domain takeover (S)        | Attacker maps their domain to another store, or claims a dangling custom domain      | DNS TXT ownership verification before activation; periodic re-verification; signed forwarded-host header from storefront to API                                                                |
| T7  | Payment tampering (T)                    | Client changes price/total; replayed or forged webhooks                              | Totals always computed server-side from DB; amounts confirmed with provider; webhook signature verification; idempotent processing via `WebhookEvent`; idempotency keys                        |
| T8  | Card data exposure (I)                   | PAN stored or logged                                                                 | Never touch PAN: provider-hosted fields/Checkout (PCI SAQ-A); log redaction; no card fields in schema                                                                                          |
| T9  | Inventory/discount race conditions (T)   | Overselling; discount code used beyond limit                                         | Transactional conditional updates (`available >= qty`), row locks / atomic counters, reservation with expiry                                                                                   |
| T10 | Malicious uploads (T, E)                 | SVG with script, polyglot files, huge files                                          | Content-type sniffing, allowlist (jpeg/png/webp/avif), size limits, re-encode images, serve from separate origin with `Content-Disposition`, no SVG in v1                                      |
| T11 | SSRF (I)                                 | "Import image from URL" hits internal network                                        | Block private/link-local ranges, DNS-rebinding-safe fetch, timeouts, size caps                                                                                                                 |
| T12 | Noisy neighbour / DoS (D)                | One tenant's traffic or bulk import degrades others                                  | Per-store + per-IP rate limits, plan usage limits, job queues with per-tenant concurrency, pagination limits                                                                                   |
| T13 | Secret leakage (I)                       | `.env` committed; provider keys in logs                                              | `.gitignore` for env files, `.env.example` only, secret scanning in CI, config validation, log redaction                                                                                       |
| T14 | Repudiation (R)                          | Staff deletes products and denies it                                                 | Append-only audit logs with actor, IP, UA, diff; platform admin actions audited separately                                                                                                     |
| T15 | Supply-chain compromise (T)              | Malicious package version                                                            | Lockfile, `minimumReleaseAge`, `onlyBuiltDependencies` allowlist, Dependabot/renovate, minimal dependencies                                                                                    |
| T16 | Injection (T)                            | SQL injection, email header injection                                                | Prisma parameterized queries (raw SQL only via tagged templates), Zod validation, email adapter builds headers from validated fields                                                           |
| T17 | Data loss (D)                            | Destructive migration, DB failure                                                    | Reviewed migrations, backups + PITR, restore drills (Phase 8), no destructive changes without approval                                                                                         |
| T18 | Customer PII misuse (I)                  | Over-broad exports, verbose logs                                                     | Least-privilege permissions for exports, PII-minimal logs, data retention policy, GDPR export/delete flows (Phase 8)                                                                           |

## Status after Phase 8

Reviewed against the implementation on 2026-10-19 — see [security-review.md](security-review.md)
for findings, fixes and accepted risks. Differences from the v0 plan above:

- **T2:** owner-only actions are members with ADMIN role, billing and `staff:manage`; staff can never
  grant more than they hold or change their own access. No separate re-auth step yet.
- **T3:** lockout after 10 failed password/TOTP attempts (15 min); 2FA changes revoke other
  sessions; merchant sign-up email verification is required before creating a store (2026-10-20).
- **T4:** Next.js server actions (origin check) + `SameSite=Lax` cookies; the API uses bearer tokens.
- **T5:** no rich text at all in v1 (plain-text descriptions), themes are data-only.
- **T6:** only one verified claim per hostname; unverified claims never block or route.
- **T9:** discount usage is counted at payment; unpaid orders per email are capped.
- **T11:** no URL-fetch features exist, so no SSRF surface.
- **T12:** per-IP limits are per process (accepted until horizontal scaling).
