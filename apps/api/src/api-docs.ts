import { randomBytes } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { Request, Response } from 'express';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { API_TOKEN_PREFIX, WEBHOOK_HEADERS, WEBHOOK_TOPICS } from '@repo/contracts';
import type { Env } from './config/env.js';

/** Sections of the reference, in reading order, with one line each. Names match @ApiTags. */
const TAGS: [string, string][] = [
  ['Auth', 'Sign-up, sign-in, two-factor authentication and sessions.'],
  ['Stores', 'Create, read, update, close and reopen stores; audit log.'],
  ['Products', 'Products, variants, options and media.'],
  ['Collections', 'Manual and automatic product collections.'],
  ['Inventory', 'Stock levels across locations, and adjustments.'],
  ['Purchasing', 'Suppliers and purchase orders.'],
  ['Orders', 'Orders, draft orders, fulfilment, returns and refunds.'],
  ['Customers', 'Customers, segments, export and redaction.'],
  ['Gift cards', 'Issue, look up and disable gift cards.'],
  ['Payments', 'Gateways, payouts accounts, payouts and chargebacks.'],
  ['Online store', 'Pages, blog, navigation and theme.'],
  ['Settings', 'Store settings: currencies, shipping, taxes and policies.'],
  ['Staff', 'Staff accounts, invitations and permissions.'],
  ['Analytics', 'Sales reports for a date range in the store’s time zone.'],
  ['Billing', 'The store’s plan, subscription and invoices.'],
  ['Developer', 'Admin API access tokens and webhook subscriptions.'],
  ['Webhooks', 'Inbound webhooks from payment providers (not for direct use).'],
  ['Storefront', 'The shopper-facing API used by storefronts: catalog, cart, checkout.'],
  ['Public', 'Unauthenticated platform data: plans and contact details.'],
  ['Platform', 'Platform administration (platform staff only).'],
  ['Health', 'Liveness and readiness checks.'],
];

function description(): string {
  const topics = WEBHOOK_TOPICS.map((t) => `\`${t}\``).join(', ');
  return `
The REST API behind the merchant admin and storefronts. Everything the admin does, you can do here.

### Base URL and versions
All paths start with \`/api/v1\`. Breaking changes ship under a new version prefix.

### Authentication
Send a bearer token: \`Authorization: Bearer <token>\`.

- **Admin API access tokens** start with \`${API_TOKEN_PREFIX}\`. Create one in the admin under
  **Settings → Developer → Admin API access tokens** and choose its permissions. A token can
  only reach the store it was created in.
- **Session tokens** come from \`POST /api/v1/auth/login\` and act as that user.

Open any endpoint, add your token under **Authentication** and send a test request from this page.

### Errors
Errors use [RFC 9457 problem details](https://www.rfc-editor.org/rfc/rfc9457)
(\`application/problem+json\`) with \`status\`, \`title\`, \`detail\` and, where useful, a
machine-readable \`code\` and field \`errors\`. Every response carries an \`x-request-id\`
header; quote it when you contact support.

### Pagination
List endpoints take \`page\` (from 1) and \`pageSize\` (1–100, default 25) and return
\`{ items, page, pageSize, total }\`.

### Rate limits
300 requests per minute per client, with tighter limits on sign-in, sign-up and password
reset. Over the limit you get \`429 Too Many Requests\`; wait and retry.

### Webhooks
Subscribe under **Settings → Developer → Webhooks**. Topics: ${topics}.
Each delivery is a JSON \`POST\` with the headers \`${WEBHOOK_HEADERS.topic}\`,
\`${WEBHOOK_HEADERS.storeId}\`, \`${WEBHOOK_HEADERS.deliveryId}\` and
\`${WEBHOOK_HEADERS.signature}\`, the base64 HMAC-SHA256 of the raw body keyed with the
subscription's secret. Verify it before trusting the payload. Failed deliveries are retried.
`.trim();
}

/** Calm, product-matched styling for Swagger UI (dark top bar removed, readable sections). */
const CSS = `
.swagger-ui .topbar { display: none }
body { background: #fafafa }
.swagger-ui { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; color: #0f172a }
.swagger-ui .info { margin: 40px 0 24px }
.swagger-ui .info .title { font-size: 34px; font-weight: 650; letter-spacing: -0.02em; color: #0f172a }
.swagger-ui .info .title small { background: #0f172a; border-radius: 999px; padding: 3px 10px }
.swagger-ui .info .title small.version-stamp { background: #e2e8f0 }
.swagger-ui .info .title small.version-stamp pre { color: #0f172a }
.swagger-ui .info .markdown p, .swagger-ui .info .markdown li { font-size: 15px; line-height: 1.65; color: #334155 }
.swagger-ui .info .markdown h3 { font-size: 17px; margin: 26px 0 6px; color: #0f172a }
.swagger-ui .info .markdown code { background: #f1f5f9; border-radius: 4px; padding: 1px 5px; font-size: 13px; color: #0f172a }
.swagger-ui .info a { color: #2563eb }
.swagger-ui .scheme-container { background: transparent; box-shadow: none; padding: 0 0 12px }
.swagger-ui .btn.authorize { border-radius: 999px; border-color: #0f172a; color: #0f172a; padding: 7px 18px }
.swagger-ui .btn.authorize svg { fill: #0f172a }
.swagger-ui .filter-container .operation-filter-input { border-radius: 10px; border: 1px solid #e2e8f0; padding: 10px 14px; margin: 8px 0 16px }
.swagger-ui .opblock-tag-section { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; margin-bottom: 12px; padding: 4px 16px }
.swagger-ui .opblock-tag { border-bottom: 0; font-size: 18px; font-weight: 600; padding: 12px 0 }
.swagger-ui .opblock-tag small { font-size: 13px; color: #64748b; font-weight: 400 }
.swagger-ui .opblock { border-radius: 10px; box-shadow: none }
.swagger-ui .opblock .opblock-summary-method { border-radius: 6px; min-width: 70px }
.swagger-ui .opblock .opblock-summary-path { font-size: 13.5px }
.swagger-ui .opblock-tag { color: #0f172a }
html.dark-mode body { background: #0b0f14 }
html.dark-mode .swagger-ui, html.dark-mode .swagger-ui .opblock-tag, html.dark-mode .swagger-ui .info .title, html.dark-mode .swagger-ui .info .markdown h3 { color: #e5e7eb }
html.dark-mode .swagger-ui .info .markdown p, html.dark-mode .swagger-ui .info .markdown li, html.dark-mode .swagger-ui .opblock-tag small { color: #94a3b8 }
html.dark-mode .swagger-ui .info .markdown code { background: #1e293b; color: #e5e7eb }
html.dark-mode .swagger-ui .info .title small { background: #e5e7eb }
html.dark-mode .swagger-ui .info .title small pre { color: #0f172a }
html.dark-mode .swagger-ui .opblock-tag-section { background: #11161d; border-color: #1f2937 }
html.dark-mode .swagger-ui .filter-container .operation-filter-input { background: #11161d; border-color: #1f2937; color: #e5e7eb }
html.dark-mode .swagger-ui .btn.authorize { border-color: #e5e7eb; color: #e5e7eb }
html.dark-mode .swagger-ui .btn.authorize svg { fill: #e5e7eb }
html.dark-mode .swagger-ui .info a { color: #60a5fa }
`;

const singular = (word: string) =>
  word.endsWith('ies')
    ? `${word.slice(0, -3)}y`
    : word.endsWith('s') && !word.endsWith('ss')
      ? word.slice(0, -1)
      : word;

/** Acronyms and phrasing fixes for generated names. */
const WORD_FIXES: Record<string, string> = {
  csv: 'CSV',
  api: 'API',
  mfa: 'MFA',
  '2fa': '2FA',
  cod: 'COD',
  tls: 'TLS',
  ai: 'AI',
  sku: 'SKU',
  razorpay: 'Razorpay',
  stripe: 'Stripe',
  signup: 'sign up',
  login: 'sign in',
  logout: 'sign out',
};
const human = (text: string) =>
  text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .toLowerCase()
    .split(' ')
    .map((w) => WORD_FIXES[w] ?? w)
    .join(' ');
const capital = (text: string) => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

/** Method names that are a bare verb and need the resource from the path. */
const VERBS: Record<string, string> = {
  list: 'list',
  get: 'get',
  create: 'create',
  update: 'update',
  replace: 'update',
  remove: 'delete',
  delete: 'delete',
  save: 'save',
};
/** First words that already say what a GET does. */
const READ_VERBS = new Set([
  'list',
  'get',
  'check',
  'search',
  'export',
  'find',
  'count',
  'preview',
  'download',
]);

/** Path segments that are namespaces, not resources. */
const NAMESPACES = new Set(['admin', 'storefront', 'platform', 'public', 'auth', 'me', 'webhooks']);

/**
 * A readable name for an endpoint from its controller method and path:
 * `ProductsController_list` on `/products` -> "List products", `updateVariant` -> "Update variant",
 * `complete` on `/draft-orders/{id}/complete` -> "Complete draft order".
 */
export function operationName(operationId: string, method: string, path: string): string {
  const fn = operationId.split('_')[1] ?? method;
  const parts = path.split('/').filter((p) => p && p !== 'api' && !/^v\d+$/.test(p));
  const isParam = (p: string) => p.startsWith('{');
  const last = parts.at(-1) ?? '';
  const resources = parts.filter((p) => !isParam(p) && !NAMESPACES.has(p) && p !== 'stores');
  const verb = VERBS[fn];
  if (fn === 'me') return 'Get current user';
  if (verb) {
    const noun = resources.at(-1) ?? parts.filter((p) => !isParam(p)).at(-1) ?? '';
    const one = isParam(last) || (verb !== 'list' && verb !== 'save');
    return capital(`${verb} ${human(one ? singular(noun) : noun)}`);
  }
  const words = human(fn);
  // A one-word action on one record: "Complete draft order", "Close store".
  if (!words.includes(' ') && last === fn && method !== 'get') {
    const owner = parts.at(-2);
    if (owner && isParam(owner)) {
      const noun = parts.at(-3) ?? '';
      return capital(`${words} ${human(singular(noun))}`);
    }
  }
  const first = words.split(' ')[0] ?? '';
  if (method === 'get' && !READ_VERBS.has(first)) {
    return capital(`${words.endsWith('s') && !words.endsWith('ss') ? 'list' : 'get'} ${words}`);
  }
  return capital(words);
}

/** Fills in a summary on every operation that has none, so the reference reads as names. */
function nameOperations(doc: OpenAPIObject): OpenAPIObject {
  for (const [path, item] of Object.entries(doc.paths)) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
      const op = item[method];
      if (op && !op.summary) op.summary = operationName(op.operationId ?? '', method, path);
    }
  }
  return doc;
}

/** Scalar API reference, pinned and loaded from jsDelivr (only on this page). */
const SCALAR_SRC = 'https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.76.4';

/** Monochrome to match the admin; Scalar's own variables, light and dark. */
const SCALAR_CSS = `
.light-mode { --scalar-color-accent: #111827; --scalar-background-1: #ffffff; --scalar-background-2: #f8fafc; --scalar-background-3: #f1f5f9; --scalar-border-color: #e5e7eb }
.dark-mode { --scalar-color-accent: #f3f4f6; --scalar-background-1: #0b0f14; --scalar-background-2: #11161d; --scalar-background-3: #1a2029; --scalar-border-color: #1f2937 }
.scalar-app { --scalar-font: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; --scalar-font-code: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; --scalar-radius: 8px; --scalar-radius-lg: 12px }
`;

function scalarPage(nonce: string): string {
  const config = {
    url: '/api/openapi.json',
    layout: 'modern',
    theme: 'none',
    customCss: SCALAR_CSS,
    withDefaultFonts: false,
    showDeveloperTools: 'never',
    showToolbar: 'never',
    agent: { disabled: true },
    hideClientButton: false,
    defaultHttpClient: { targetKey: 'node', clientKey: 'fetch' },
    authentication: { preferredSecurityScheme: 'bearer' },
    metaData: { title: 'API reference · Commerce Platform' },
  };
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>API reference · Commerce Platform</title>
<meta name="description" content="REST API reference for Commerce Platform: authentication, errors, pagination, webhooks and every endpoint.">
</head>
<body>
<div id="app"></div>
<script nonce="${nonce}" src="${SCALAR_SRC}"></script>
<script nonce="${nonce}">Scalar.createApiReference('#app', ${JSON.stringify(config)});</script>
</body>
</html>`;
}

/**
 * Serves the API reference at /api/docs (Scalar), the OpenAPI document at /api/openapi.json and
 * the plain Swagger UI at /api/docs/swagger. On unless API_DOCS=false: the reference describes
 * routes that all enforce their own authentication.
 */
export function setupApiDocs(app: INestApplication, env: Env): void {
  if (env.API_DOCS === 'false') return;
  const builder = new DocumentBuilder()
    .setTitle('Commerce Platform API')
    .setDescription(description())
    .setVersion('v1')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      description: `An Admin API access token (${API_TOKEN_PREFIX}…) or a session token.`,
    });
  for (const [name, text] of TAGS) builder.addTag(name, text);
  const config = builder.build();
  SwaggerModule.setup(
    'api/docs/swagger',
    app,
    () => nameOperations(SwaggerModule.createDocument(app, config)),
    {
      jsonDocumentUrl: 'api/openapi.json',
      customSiteTitle: 'API reference (Swagger) · Commerce Platform',
      customCss: CSS,
      swaggerOptions: {
        docExpansion: 'none',
        filter: true,
        persistAuthorization: true,
        displayRequestDuration: true,
        defaultModelsExpandDepth: -1,
      },
    },
  );
  const serve = (_req: Request, res: Response) => {
    const nonce = randomBytes(16).toString('base64');
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        `script-src 'nonce-${nonce}' https://cdn.jsdelivr.net`,
        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
        "img-src 'self' data: https:",
        "font-src 'self' data: https://cdn.jsdelivr.net",
        "connect-src 'self'",
        "worker-src 'self' blob:",
        "frame-ancestors 'none'",
        "base-uri 'none'",
        "form-action 'self'",
      ].join('; '),
    );
    res.type('html').send(scalarPage(nonce));
  };
  const http = app.getHttpAdapter();
  http.get('/api/docs', serve);
  http.get('/api/docs/', serve);
}
