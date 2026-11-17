import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
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

Click **Authorize** above and paste a token to try requests from this page.

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

/**
 * Serves the OpenAPI reference at /api/docs (JSON at /api/docs-json). On unless API_DOCS=false:
 * the reference describes routes that all enforce their own authentication.
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
  SwaggerModule.setup('api/docs', app, () => SwaggerModule.createDocument(app, config), {
    customSiteTitle: 'API reference · Commerce Platform',
    customCss: CSS,
    swaggerOptions: {
      docExpansion: 'none',
      filter: true,
      persistAuthorization: true,
      displayRequestDuration: true,
      defaultModelsExpandDepth: -1,
      tryItOutEnabled: false,
    },
  });
}
