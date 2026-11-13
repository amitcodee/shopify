#!/usr/bin/env node
// Push billing settings to the Coolify staging resource and redeploy it, through the Coolify API.
//
//   node scripts/coolify-sync.mjs            # update env vars + redeploy + wait for the deploy
//   node scripts/coolify-sync.mjs --dry-run  # show what would change, touch nothing
//
// Needs a Coolify API token (Coolify → Keys & Tokens → API tokens, permission "write" +
// "deploy") saved as the only line of `.coolify-token` in the repo root (gitignored).
// The Razorpay test key is read from `apps/api/.env` (commented-out lines are fine).
// Secret values are never printed.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const BASE = process.env.COOLIFY_URL ?? 'http://200.234.38.152:8000';
const NAME = process.env.COOLIFY_RESOURCE ?? 'shopify';
// `none` keeps the Razorpay offer off: trial subscribers (most merchants) cannot use it anyway, and
// the intro price reaches everyone through the separate intro mandate.
const OFFER_ID = process.env.OFFER_ID ?? 'none';
const dryRun = process.argv.includes('--dry-run');

const tokenFile = `${root}.coolify-token`;
if (!existsSync(tokenFile)) {
  console.error(`Missing ${tokenFile}. Create a Coolify API token and save it there.`);
  process.exit(1);
}
const token = readFileSync(tokenFile, 'utf8').trim();

// Values from apps/api/.env, including `# KEY=value` lines.
const env = {};
for (const line of readFileSync(`${root}apps/api/.env`, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*#?\s*([A-Z0-9_]+)=(.*)$/);
  if (m && m[2].trim()) env[m[1]] = m[2].trim();
}
const want = {
  RAZORPAY_KEY_ID: env.RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET: env.RAZORPAY_KEY_SECRET,
  BILLING_RAZORPAY_KEY_ID: env.BILLING_RAZORPAY_KEY_ID,
  BILLING_RAZORPAY_KEY_SECRET: env.BILLING_RAZORPAY_KEY_SECRET,
  BILLING_RAZORPAY_OFFER_ID: OFFER_ID,
};
for (const [k, v] of Object.entries(want)) {
  if (!v) {
    console.error(`No value for ${k} in apps/api/.env`);
    process.exit(1);
  }
}

async function api(method, path, body) {
  const res = await fetch(`${BASE}/api/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

// The staging stack may be a docker-compose "application" or a "service".
const [apps, services] = await Promise.all([
  api('GET', '/applications').catch(() => []),
  api('GET', '/services').catch(() => []),
]);
const candidates = [
  ...apps.map((r) => ({ kind: 'applications', r })),
  ...services.map((r) => ({ kind: 'services', r })),
].filter(({ r }) => String(r.name ?? '').toLowerCase().startsWith(NAME));
if (candidates.length !== 1) {
  console.error(
    `Expected one resource named ${NAME}*, found: ${candidates.map(({ r }) => r.name).join(', ') || 'none'}`,
  );
  process.exit(1);
}
const { kind, r: resource } = candidates[0];
console.log(`Resource: ${resource.name} (${kind}, ${resource.uuid})`);

const current = await api('GET', `/${kind}/${resource.uuid}/envs`);
const byKey = new Map();
for (const e of current) if (!e.is_preview) byKey.set(e.key, e);

const mask = (k, v) => (/SECRET|TOKEN|PASSWORD/.test(k) ? `<${v.length} chars>` : v);
const changes = Object.entries(want).filter(([k, v]) => byKey.get(k)?.value !== v);
if (!changes.length) console.log('Env vars already up to date.');
for (const [k, v] of changes) {
  console.log(`${byKey.has(k) ? 'update' : 'create'} ${k} = ${mask(k, v)}`);
  if (dryRun) continue;
  if (byKey.has(k)) await api('PATCH', `/${kind}/${resource.uuid}/envs`, { key: k, value: v });
  else await api('POST', `/${kind}/${resource.uuid}/envs`, { key: k, value: v });
}
if (dryRun) process.exit(0);

const deploy = await api('GET', `/deploy?uuid=${resource.uuid}&force=false`);
const dep = deploy?.deployments?.[0];
console.log(`Deploy queued: ${dep?.deployment_uuid ?? JSON.stringify(deploy)}`);
if (!dep?.deployment_uuid) process.exit(0);

// Builds queue behind other projects on this server; wait up to 30 minutes.
const started = Date.now();
for (;;) {
  await new Promise((r) => setTimeout(r, 20_000));
  const d = await api('GET', `/deployments/${dep.deployment_uuid}`).catch(() => null);
  const status = d?.status ?? 'unknown';
  console.log(`${Math.round((Date.now() - started) / 1000)}s: ${status}`);
  if (['finished', 'failed', 'cancelled-by-user', 'error'].includes(status)) {
    process.exit(status === 'finished' ? 0 : 1);
  }
  if (Date.now() - started > 30 * 60_000) {
    console.error('Still deploying after 30 minutes; check Coolify.');
    process.exit(1);
  }
}
