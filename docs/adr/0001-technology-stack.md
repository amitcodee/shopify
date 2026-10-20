# ADR 0001 — Technology stack and version pins

- Status: Accepted
- Date: 2026-10-19

## Context

The proposed stack is pnpm + Turborepo, Next.js, NestJS, PostgreSQL + Prisma, Redis + BullMQ, Vitest/Playwright, on native Windows. Package compatibility was checked against the npm registry on 2026-10-19 before installation.

## Decision

Keep the proposed stack, with these version constraints:

| Tool            | Pinned                                                                   | Why not "latest"                                                                                                                                        |
| --------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js         | 24.x LTS                                                                 | —                                                                                                                                                       |
| pnpm            | 10.34.x                                                                  | 12.x is latest; 10.x is mature, well supported by Turborepo, blocks dependency install scripts by default, supports `minimumReleaseAge`. Revisit later. |
| TypeScript      | 6.0.x                                                                    | 7.0 (native Go compiler) is not supported by `typescript-eslint` (`<6.1.0`) or `@nestjs/cli` (`~6.0.2`).                                                |
| ESLint          | 9.x                                                                      | 10.x is not supported by `eslint-plugin-react`, `jsx-a11y`, `import` (used by `eslint-config-next`).                                                    |
| NestJS          | 12.x                                                                     | NestJS 12 is ESM-only, so `apps/api` is an ES module (`"type": "module"`, `NodeNext`).                                                                  |
| Next.js / React | 16.x / 19.x                                                              | —                                                                                                                                                       |
| Tailwind CSS    | 4.x                                                                      | —                                                                                                                                                       |
| Vitest          | 5.x (+ `vite` 8 as explicit peer, `unplugin-swc` for decorator metadata) | —                                                                                                                                                       |
| Prisma          | 7.10.x (Phase 2)                                                         | The `prisma` CLI `latest` tag currently points at `8.0.0-rc.*`; `@prisma/client` latest is 7.10.1. Use stable 7.x for both.                             |

Shared request/response contracts use **Zod 4** in `packages/contracts` so the API and both frontends validate against the same schemas.

Supply-chain hygiene: `pnpm-workspace.yaml` sets `minimumReleaseAge` (packages must be ≥1 day old) and an explicit `onlyBuiltDependencies` allowlist.

## Deferred decisions

- **Authentication** (Phase 2): proposal is Better Auth (self-hosted, DB-backed sessions, Prisma adapter) behind our own `AuthGuard`; authorization (store membership, roles) stays in our code. Alternative: hand-rolled sessions with argon2id. Decide with an ADR at Phase 2 start.
- **Local PostgreSQL/Redis provisioning**: native install vs Docker Desktop (Hyper-V backend avoids WSL). Decide before Phase 2.
