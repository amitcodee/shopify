# ADR 0003 — Local infrastructure on native Windows; background jobs on PostgreSQL

- Status: Accepted
- Date: 2026-10-19

## Context

Docker Desktop, PostgreSQL and Redis were not installed. Installers (winget/MSI) need admin rights
and a UAC prompt; Docker Desktop additionally needs Hyper-V or WSL. The project must run on native
Windows without WSL.

## Decision

1. **PostgreSQL 18.4 from EnterpriseDB's official portable binaries** (`D:\devtools\pgsql-18`), with
   the cluster under `D:\devtools\shopify-pg` (outside the repo). Managed by `scripts/dev-db.ps1`
   (`init | start | stop | status | psql`). No admin rights, no Windows service. `init` creates
   three roles with random passwords and writes connection strings into git-ignored `.env` files:
   - `shop_owner` — owns the schema, runs migrations;
   - `shop_app` — used by the API; **subject to row-level security**;
   - `shop_platform` — `BYPASSRLS`; platform admin and background jobs only.
2. **No Redis/BullMQ for now.** Background work (emails, webhooks follow-up) uses a
   **transactional outbox table in PostgreSQL** processed by a worker with
   `FOR UPDATE SKIP LOCKED`. Enqueueing happens in the same transaction as the business change, so
   jobs are never lost or sent for rolled-back work. Rate limiting uses in-memory throttling.
   Redis + BullMQ can be introduced behind the same job interface when we scale beyond one API
   instance or need high-throughput queues.

## Consequences

- One less service to install and operate locally; fewer moving parts in Phase 5.
- In-memory rate limits are per-process; production with several API instances needs a shared
  store (Redis) — tracked in the Phase 8 deployment checklist.
