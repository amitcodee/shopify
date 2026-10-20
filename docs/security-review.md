# Security review (Phase 8)

**Date:** 2026-10-19 · **Scope:** the whole repository at the end of Phase 7 plus Phase 8 part 1
(API, admin, storefront, database migrations/RLS, deployment files). **Method:** manual review
against the [threat model](threat-model.md) (STRIDE), focused on tenant isolation, authorization
inside a store, authentication, payments/checkout, custom domains, secrets and deployment. Each
finding was fixed with a regression test where it is testable.

## Findings and fixes

| #   | Severity | Finding                                                                                                                                                                                                                        | Fix                                                                                                                                                                                                                                 | Test                                                          |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1   | High     | **Privilege escalation inside a store.** A STAFF member holding `staff:manage` could invite ADMINs, grant permissions they did not hold (including `billing:manage`/`staff:manage`), change ADMINs, and edit their own access. | `assertCanAssign` in `StaffService`: nobody edits their own membership; only the owner assigns ADMIN, changes ADMINs or grants owner-only permissions; nobody grants a permission they lack.                                        | `staff.e2e` — "staff with staff:manage cannot grant more…"    |
| 2   | High     | **Invitation link returned to the inviter.** `POST …/staff/invitations` returned `acceptUrl`, so an inviter could create the invitee's account (and choose its password) without the invitee ever seeing the email.            | The link is only emailed; the API returns the invitation without it. Accepting therefore proves control of the inbox.                                                                                                               | `staff.e2e` (asserts no `acceptUrl`; token read from mailbox) |
| 3   | Medium   | **Unpaid checkouts consumed shared resources.** Unpaid orders counted toward the store's monthly order quota and redeemed limited-use discount codes; one email could hold stock with unlimited pending orders.                | Quota counts **paid** orders only; discount redemptions are counted at payment (capped increment, never fails after money is taken); at most 3 unexpired unpaid orders per email (HTTP 429).                                        | `checkout.e2e`, `settings.e2e`, `platform.e2e`                |
| 4   | Medium   | **Custom-domain squatting.** `Domain.hostname` was globally unique, so the first (unverified) claim blocked the real owner forever.                                                                                            | Unique per store; a partial unique index allows only **one verified** row per hostname; verification returns 409 if another store verified it; the resolver only routes verified claims; unverified claims are purged after 7 days. | `settings.e2e` — "does not let an unverified claim block…"    |
| 5   | Medium   | **No account lockout; 2FA changes kept other sessions.** Password/TOTP guessing was only limited per IP; a stolen session survived the victim turning on 2FA.                                                                  | 10 failed password or code attempts lock the account for 15 minutes (atomic counter on `User`); enabling/disabling 2FA signs out every other session.                                                                               | `hardening.e2e`                                               |
| 6   | Medium   | **All containers shared one env file**, so the storefront/admin received database and schema-owner credentials, Stripe keys, etc.                                                                                              | One env file per service (`deploy/env/*.env.example`): only `migrate` gets the owner role, the Next.js apps get no database credentials, Caddy gets no app secrets.                                                                 | review of `deploy/docker-compose.prod.yml`                    |
| 7   | Medium   | **No production email transport**, and sent outbox rows kept full bodies (order details, one-time links) for 30 days.                                                                                                          | `PostmarkEmailSender` (HTTP API, timeout, retried by the outbox); `EMAIL_TRANSPORT=mailbox` is refused in production; sent rows keep only the subject.                                                                              | `env.test.ts`                                                 |
| 8   | Low      | **Login redirect check by string prefix.** `next=/\t/evil.example` and similar browser-normalised forms were accepted.                                                                                                         | `safeRelativePath` (contracts): refuses control characters and backslashes, resolves the URL and requires the same origin.                                                                                                          | `redirects.test.ts`                                           |
| 9   | Low      | **Idempotency-key replay disclosed the payment link** to anyone who learned the key.                                                                                                                                           | A replay only resumes the order for the same cart (cart token hash must match); otherwise 409.                                                                                                                                      | `checkout.e2e`                                                |
| 10  | Low      | **Refund restock race.** The post-provider transaction did not re-lock the order, so two concurrent refunds could restock the same units twice.                                                                                | `SELECT … FOR UPDATE` on the order before re-reading lines; restock clamps to the freshly read remaining quantity.                                                                                                                  | covered by existing refund tests (race not deterministic)     |
| 11  | Low      | **Customer activation/reset token double use.** Two concurrent requests could both pass the `usedAt` check.                                                                                                                    | Conditional claim (`updateMany … where usedAt is null`) with a count check.                                                                                                                                                         | existing token tests                                          |
| 12  | Low      | **Template placeholders accepted as secrets.** `CHANGE_ME…` values (≥ 32 chars) passed validation.                                                                                                                             | The env schema rejects any secret containing `CHANGE_ME` in every environment.                                                                                                                                                      | `env.test.ts`                                                 |

Schema changes for findings 4 and 5 are in migration `20261019113000_review_fixes` (additive
columns; the hostname unique index is replaced by per-store + verified-only indexes — no data loss).

## Verified as sound (no change needed)

- Tenant isolation: every tenant table has forced RLS (schema test fails if one is added without
  it); the store comes from membership (`StoreAccessGuard`) or the signed storefront host, never
  from client input; composite `(storeId, id)` foreign keys.
- Payments: totals are computed server-side; webhooks are signature-verified, de-duplicated and
  amount-checked; no card data is handled (hosted checkout).
- Uploads: images are decoded and re-encoded (no SVG), served with a sandbox CSP.
- XSS: React escaping, no merchant HTML, nonce-based CSP on both apps.
- CSRF: the admin and storefront use server actions (Next.js origin check) with `SameSite=Lax`
  HttpOnly cookies; the API itself is bearer-token based and not cookie-authenticated.
- SSRF: there is no "fetch a URL" feature; outbound calls go only to fixed provider endpoints.

## Accepted risks

| Risk                                                                            | Why accepted / mitigation                                                                                                                               |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The lockout message reveals that an account exists.                             | Usability over secrecy; per-IP throttling bounds the rate. Since 2026-10-20 the owner is emailed an unlock link, so a lockout no longer keeps them out. |
| `pnpm audit`: 1 high advisory (`braces` via `eslint-config-next`).              | Development/lint-time only, not shipped in any runtime image.                                                                                           |
| Container images were not built locally (no Docker on the development machine). | The standalone builds were booted natively; CI must build the images before the first release.                                                          |

## Follow-ups closed after the review

- **2026-10-20 — merchant sign-up email verification** (was an accepted risk). Sign-up queues a
  24-hour signed link (HMAC, bound to the user id _and_ current email) through the outbox; the
  admin `/verify-email/<token>` page confirms on a button press, so link scanners that prefetch
  cannot verify. Creating a store requires a verified email (HTTP 403); signed-in users can
  request a new link (3 per 10 minutes). Tests: `auth.e2e` — "email verification",
  `admin-onboarding.spec` — "must confirm their email".
- **2026-10-20 — merchant payouts with Stripe Connect** (was an accepted risk blocking real
  merchants). Express connected account per store with hosted onboarding; destination charges
  with `on_behalf_of` and the plan fee as `application_fee_amount`; refunds reverse the transfer.
  Checkout returns 409 before reserving stock unless the store's account can take charges.
  Connect webhooks have their own signing secret and endpoint, are de-duplicated, and a
  deauthorized account is never revived. `PaymentAccount` is under forced RLS; only owners
  manage payouts ([ADR 0006](adr/0006-stripe-connect-payouts.md)). Tests: `payments.e2e`,
  `stripe-connect.provider.test`, `payments.spec`.
- **2026-10-20 — shared rate limits** (was an accepted risk). Throttler counters live in an
  UNLOGGED PostgreSQL table updated by one atomic upsert per request (fixed windows, database
  clock), so limits hold across API instances; stale rows are swept by the daily cleanup job.
  While adding it we found that raw SQL using `now()` disagreed with Prisma's UTC timestamps when
  the database server was not in UTC (a 15-minute lockout lasted 5h45m on an IST server); every
  connection now runs with `TimeZone=UTC`. Tests: `rate-limit.e2e`, `hardening.e2e` (lockout
  upper bound).
- **2026-10-20 — account recovery.** Locking an account emails the owner a single-use unlock
  link (bound to that lockout) and a password reset link. Merchants can reset a forgotten
  password: the link is HMAC-signed, expires in 1 hour, is bound to the current password hash
  (single use), clears lockouts, signs out every session and does not sign in, so 2FA still
  applies. The forgot-password endpoint answers the same for unknown emails. Tests:
  `account-recovery.e2e`, `account-recovery.spec`.
