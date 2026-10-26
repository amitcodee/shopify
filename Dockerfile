# syntax=docker/dockerfile:1.7
# Multi-target build for the platform. Build one target at a time, e.g.:
#   docker build --target api -t commerce-api .
#   docker build --target admin -t commerce-admin .
#   docker build --target storefront -t commerce-storefront .
#   docker build --target migrate -t commerce-migrate .
# The worker uses the api image with `node dist/worker.js`.

FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1 TURBO_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
ENV NEXT_OUTPUT=standalone
RUN pnpm turbo run build \
 && pnpm --filter @repo/api --prod deploy --legacy /out/api

# Applies database migrations (run once per release, before starting new app versions).
FROM build AS migrate
WORKDIR /repo/packages/db
CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]

FROM node:24-bookworm-slim AS api
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out/api ./
# Created here (owned by node) so a fresh named volume mounted at /app/storage inherits a
# writable directory; otherwise Docker creates it as root and media uploads fail.
RUN mkdir -p /app/storage && chown node:node /app/storage
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:'+(process.env.API_PORT||4000)+'/api/v1/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]

FROM node:24-bookworm-slim AS admin
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/admin/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/admin/.next/static ./apps/admin/.next/static
# Standalone output leaves out public/ (stock photos under /media, synced from packages/assets).
COPY --from=build --chown=node:node /repo/apps/admin/public ./apps/admin/public
USER node
EXPOSE 3000
CMD ["node", "apps/admin/server.js"]

FROM node:24-bookworm-slim AS storefront
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/storefront/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/storefront/.next/static ./apps/storefront/.next/static
# Standalone output leaves out public/ (stock photos under /media, synced from packages/assets).
COPY --from=build --chown=node:node /repo/apps/storefront/public ./apps/storefront/public
USER node
EXPOSE 3000
CMD ["node", "apps/storefront/server.js"]
