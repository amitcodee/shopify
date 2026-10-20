# ADR 0002 — Authentication: first-party sessions

- Status: Accepted
- Date: 2026-10-19

## Decision

Use first-party, database-backed sessions instead of an auth library/provider.

- Passwords: Argon2id (`@node-rs/argon2`, OWASP parameters m=19 MiB, t=2, p=1). Login on an unknown
  email still runs a dummy verification so timing does not reveal which emails exist.
- Sessions: 256-bit random opaque token; only its SHA-256 is stored (`Session.tokenHash`), so a
  database leak does not yield usable tokens. 30-day absolute expiry (`SESSION_TTL_DAYS`), revoked
  on logout, rejected when the user is disabled.
- Transport: the admin app is a backend-for-frontend. Next.js server actions call the API with
  `Authorization: Bearer <token>`; the browser only ever holds the token in an `HttpOnly`,
  `SameSite=Lax`, `Secure` (in production) cookie on the admin origin. The browser never calls the
  API directly, so the API needs no cookie handling and is not exposed to CSRF; Next.js server
  actions additionally verify the `Origin` header.
- Authorization stays in our code: global `AuthGuard` (fail closed, opt-out with `@Public()`),
  `StoreAccessGuard` (membership, 404 for non-members), `@RequirePermission()` (role matrix in
  `@repo/contracts`).
- Rate limits: `@nestjs/throttler` — 5 sign-ups and 10 logins per minute per client IP.

## Why not Better Auth (the earlier proposal)

Our model has two separate identity realms — staff users (global) and **per-store customer
accounts** (tenant-scoped, Phase 4). A library built around one user table would cover only the
first and we would still hand-roll the second. The primitives above are small, well understood,
and fully tested (`apps/api/test/auth.e2e.test.ts`).

## Consequences / follow-ups

- Email verification and password reset ship with the notification system (Phase 5).
- Optional TOTP 2FA for staff and mandatory for super-admins is tracked for Phase 8.
