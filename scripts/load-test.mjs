// Storefront API load test (no dependencies).
// Usage: node scripts/load-test.mjs [host=demo.localhost:3200] [seconds=15] [concurrency=20]
// Requires the API running (default http://localhost:4000) and STOREFRONT_SHARED_SECRET in apps/api/.env.
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

const env = parseEnv(readFileSync(new URL('../apps/api/.env', import.meta.url), 'utf8'));
const API = process.env.API_URL ?? 'http://localhost:4000';
const [host = 'demo.localhost:3200', seconds = '15', concurrency = '20'] = process.argv.slice(2);
const secret = env.STOREFRONT_SHARED_SECRET;

function signedHeaders(extra = {}) {
  const ts = String(Date.now());
  const signature = createHmac('sha256', secret)
    .update(`${host.toLowerCase()}\n${ts}`)
    .digest('hex');
  return {
    'x-storefront-host': host,
    'x-storefront-ts': ts,
    'x-storefront-signature': signature,
    'content-type': 'application/json',
    ...extra,
  };
}

// Each virtual user acts as a distinct shopper IP (the storefront server forwards X-Forwarded-For).
async function call(path, init = {}, ip = `203.0.113.${Math.floor(Math.random() * 250) + 1}`) {
  const started = performance.now();
  const res = await fetch(`${API}/api/v1/storefront${path}`, {
    ...init,
    headers: signedHeaders({ 'x-forwarded-for': ip, ...init.headers }),
  });
  const body = await res.text();
  return { ms: performance.now() - started, status: res.status, body };
}

function percentile(sorted, p) {
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0;
}

async function scenario(name, fn) {
  const latencies = [];
  let errors = 0;
  const deadline = Date.now() + Number(seconds) * 1000;
  const worker = async (index) => {
    let n = 0;
    while (Date.now() < deadline) {
      // Many distinct shoppers (realistic per-IP rates) so the per-IP rate limit is not the bottleneck.
      const ip = `10.${index % 250}.${Math.floor(n / 250) % 250}.${n++ % 250}`;
      const r = await fn(ip);
      latencies.push(r.ms);
      if (r.status >= 400) errors++;
    }
  };
  const started = Date.now();
  await Promise.all(Array.from({ length: Number(concurrency) }, (_, i) => worker(i)));
  const elapsed = (Date.now() - started) / 1000;
  latencies.sort((a, b) => a - b);
  console.log(
    `${name.padEnd(22)} ${String(latencies.length).padStart(6)} req  ${(latencies.length / elapsed).toFixed(0).padStart(5)} req/s` +
      `  p50 ${percentile(latencies, 50).toFixed(1).padStart(6)} ms  p95 ${percentile(latencies, 95).toFixed(1).padStart(6)} ms` +
      `  p99 ${percentile(latencies, 99).toFixed(1).padStart(6)} ms  errors ${errors}`,
  );
}

const products = JSON.parse((await call('/products')).body);
const handle = products.items?.[0]?.handle;
const variantProduct = JSON.parse((await call(`/products/${handle}`)).body);
const variantId = variantProduct.variants?.find((v) => v.available)?.id;
if (!handle || !variantId) throw new Error(`No products found for ${host}; run the seed first.`);

console.log(
  `Load test: ${host} via ${API}, ${seconds}s per scenario, concurrency ${concurrency}\n`,
);
await scenario('shop info', (ip) => call('/shop', {}, ip));
await scenario('product listing', (ip) => call('/products?sort=price-asc', {}, ip));
await scenario('product page', (ip) => call(`/products/${handle}`, {}, ip));
await scenario('search', (ip) => call('/products?q=sum', {}, ip));
await scenario('cart create + add', async (ip) => {
  const created = await call('/cart', { method: 'POST' }, ip);
  const token = JSON.parse(created.body).token;
  const added = await call(
    '/cart/lines',
    {
      method: 'POST',
      headers: { 'x-cart-token': token },
      body: JSON.stringify({ variantId, quantity: 1 }),
    },
    ip,
  );
  return { ms: created.ms + added.ms, status: Math.max(created.status, added.status) };
});
