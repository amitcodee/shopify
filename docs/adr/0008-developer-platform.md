# ADR 0008 — Admin API access tokens and outbound webhooks

- Status: Accepted
- Date: 2026-10-21

## Context

Merchants connect ERPs, fulfilment services and scripts to their store. They need to call the
Admin API without a staff session and to hear about events (orders paid, products changed)
without polling. Both are attack surfaces: a long-lived credential and a feature that makes the
platform send requests to merchant-chosen URLs (SSRF).

## Decision

**Access tokens.** `cpat_<256 random bits>`, stored as SHA-256 only, shown once. A token belongs
to one store and lists its permissions (never `staff:manage` or `billing:manage`). It
authenticates as its creator, but:

- the auth guard only lets it reach `/api/v1/admin/stores/<its store>/…`, never account,
  platform or `/api-tokens` routes, so a token cannot sign in as a person or mint more tokens;
- the store guard acts as `STAFF` with the token's permissions intersected with the creator's
  _current_ role, so demoting or removing the creator shrinks or kills the token;
- nobody can grant permissions they do not hold; tokens are revocable and record `lastUsedAt`.

`ApiToken` has no RLS (like `StoreMember`), because it is looked up by hash before the store is
known; every query filters by store and the guards enforce the scope.

**Webhooks.** Subscriptions per store and topic (`orders/paid`, `orders/cancelled`,
`orders/fulfilled`, `refunds/created`, `products/created|updated|deleted`). The signing secret is
encrypted at rest and shown once. Events are written as `WebhookDelivery` rows in the same
transaction as the change (outbox), so a webhook fires if and only if the change commits.

A worker job claims due deliveries with a short lease (`FOR UPDATE SKIP LOCKED`) and sends them
outside any transaction: JSON body, `x-commerce-topic`, `x-commerce-store-id`,
`x-commerce-webhook-id` and `x-commerce-hmac-sha256` (base64 HMAC of the raw body). 2xx is
success; other answers are retried after 1 min, 5 min, 30 min, 2 h, 6 h and 24 h, then marked
failed. After 20 consecutive failed attempts a subscription is disabled until the merchant
re-enables it. Deliveries are kept 30 days.

**SSRF.** Outbound requests resolve the host and refuse it if any address is loopback, private,
CGNAT, link-local (cloud metadata), multicast or otherwise special (IPv4 and IPv6, including
IPv4-mapped); the connection uses the vetted address, so DNS rebinding cannot swap in an
internal IP. IP-literal URLs are checked the same way. Redirects are not followed, requests time
out after 5 s, and production requires https. `WEBHOOK_ALLOW_PRIVATE_URLS` (default: allowed
only outside production) exists for local development.

## Consequences

- Integrations get least-privilege, revocable credentials; the Admin API does not change.
- Receivers must verify the HMAC and tolerate duplicate deliveries (retries after a lost
  response); `x-commerce-webhook-id` is stable across retries for de-duplication.
- No OAuth app installation flow or per-app scopes yet; tokens are created by store staff.
