#!/usr/bin/env bash
# Builds the production images and boots deploy/docker-compose.prod.yml (without Caddy) with
# throwaway secrets, then checks every service answers from inside the compose network:
# migrations apply, the API is ready (database reachable), the worker's heartbeat is healthy,
# both Next.js apps render, and the media volume is writable. Used by CI; needs Docker with the compose plugin. Nothing here talks to Stripe,
# Razorpay or Postmark: the fake keys only have to pass the API's production config checks.
set -euo pipefail

cd "$(dirname "$0")/../deploy"
compose=(docker compose -f docker-compose.prod.yml -p commerce-smoke)

# One random value replaces every CHANGE_ME placeholder, so the database passwords in
# postgres.env, api.env and migrate.env agree with each other.
secret="ci$(openssl rand -hex 24)"
for example in env/*.env.example; do
  sed -E "s/CHANGE_ME[A-Za-z0-9_]*/${secret}/g" "$example" > "${example%.example}"
done

cleanup() {
  status=$?
  if [ "$status" -ne 0 ]; then
    "${compose[@]}" ps -a || true
    "${compose[@]}" logs --no-color --tail 200 || true
  fi
  "${compose[@]}" down -v --remove-orphans > /dev/null 2>&1 || true
  rm -f env/*.env
  exit "$status"
}
trap cleanup EXIT

"${compose[@]}" build
"${compose[@]}" up -d --wait --wait-timeout 120 postgres
# Migrations first (as in a release), then the long-running services without re-running it.
"${compose[@]}" up --no-log-prefix --exit-code-from migrate migrate
"${compose[@]}" up -d --no-deps --wait --wait-timeout 180 api worker admin storefront

# Requests a URL from inside a service container (the images ship Node, not curl) with the given
# Host header, and fails on no response or a 5xx.
probe() {
  local service=$1 url=$2 host=${3:-}
  "${compose[@]}" exec -T "$service" node -e '
    const [url, host] = process.argv.slice(1);
    const req = require("node:http").get(url, { headers: host ? { host } : {} }, (res) => {
      console.log(res.statusCode, url, host);
      process.exit(res.statusCode < 500 ? 0 : 1);
    });
    req.setTimeout(30000, () => req.destroy(new Error("timed out")));
    req.on("error", (e) => { console.error(url, e.message); process.exit(1); });
  ' "$url" "$host"
}

probe api http://127.0.0.1:4000/api/v1/health/ready
probe api http://storefront:3000/ demo.example-commerce.com
probe api http://admin:3000/login admin.example-commerce.com
# Product images are written to the media volume as the unprivileged node user.
"${compose[@]}" exec -T api node -e 'require("node:fs").accessSync("/app/storage", require("node:fs").constants.W_OK)'
"${compose[@]}" exec -T worker node -e 'require("node:fs").accessSync("/app/storage", require("node:fs").constants.W_OK)'

echo "Production images build and boot."
