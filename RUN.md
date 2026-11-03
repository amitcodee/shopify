# Run it locally

## Quick start

Double-click `run.cmd`, or run this in CMD:

```cmd
cd /d D:\shopify
run.cmd
```

It starts PostgreSQL, applies migrations, builds what changed, opens one window per server, and
opens the browser when everything responds.

| Open this      | URL                            |
| -------------- | ------------------------------ |
| Demo store     | http://demo.localhost:3200     |
| Marketing site | http://localhost:3200          |
| Merchant admin | http://localhost:3101          |
| API docs       | http://localhost:4000/api/docs |

| Login           | Email                  | Password                |
| --------------- | ---------------------- | ----------------------- |
| Merchant (demo) | `merchant@example.com` | `merchant-password-123` |
| Platform admin  | `admin@example.com`    | `admin-password-123`    |

These accounts come from the seed and are for local development only.

## Commands

| Command                   | What it does                                           |
| ------------------------- | ------------------------------------------------------ |
| `run.cmd`                 | Start everything, rebuilding first if the code changed |
| `run.cmd nobuild`         | Start everything using the existing build              |
| `run.cmd stop`            | Close the 3 server windows                             |
| `scripts\dev-db.ps1 stop` | Stop PostgreSQL (`run.cmd stop` leaves it running)     |

Stop the servers before rebuilding, because a rebuild replaces files they are using.

## First-time setup

You only need this once per machine. Requirements: Node.js 24, pnpm 10.34, Git, and the portable
PostgreSQL 18 binaries in `D:\devtools\pgsql-18`.

```cmd
pnpm install
copy apps\api\.env.example apps\api\.env
copy apps\admin\.env.example apps\admin\.env.local
copy apps\storefront\.env.example apps\storefront\.env.local
```

Set these before continuing:

- `STOREFRONT_SHARED_SECRET`: 32+ random characters, the same value in `apps\api\.env` and
  `apps\storefront\.env.local`.
- `APP_ENCRYPTION_KEY`: 32+ random characters, in `apps\api\.env`.

Then create the database and the demo data:

```cmd
powershell -ExecutionPolicy Bypass -File scripts\dev-db.ps1 init
pnpm --filter @repo/db build
pnpm --filter @repo/db migrate:deploy
pnpm --filter @repo/api build
pnpm --filter @repo/api seed
run.cmd
```

## Good to know

- Payments use the sandbox provider, so no real money moves. Emails are saved to
  `apps\api\storage\mailbox\` instead of being sent.
- The admin runs on port 3101 here because another project on this machine uses 3100.

## If something goes wrong

| Problem                      | Fix                                                                                     |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| `Port ... is already in use` | Run `run.cmd stop`. If it persists, another program holds the port: close that program. |
| PostgreSQL did not start     | Read `D:\devtools\shopify-pg\postgres.log`.                                             |
| A server did not respond     | Read the error in that server's window.                                                 |
| Demo store shows no data     | Run `pnpm --filter @repo/api seed`.                                                     |
