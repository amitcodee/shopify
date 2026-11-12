import { z } from 'zod';

export const ENV = Symbol('ENV');

const originList = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.url({ protocol: /^https?$/ })));

const postgresUrl = z.url({ protocol: /^postgres(ql)?$/ });

export const GATEWAYS = ['mock', 'stripe', 'razorpay'] as const;
export type Gateway = (typeof GATEWAYS)[number];

const gatewayList = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((name) => name.trim().toLowerCase())
      .filter(Boolean),
  )
  .pipe(z.array(z.enum(GATEWAYS)).min(1));

const SECRET_KEYS = [
  'DATABASE_URL',
  'DATABASE_URL_PLATFORM',
  'STOREFRONT_SHARED_SECRET',
  'APP_ENCRYPTION_KEY',
  'MOCK_PAYMENT_WEBHOOK_SECRET',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_CONNECT_WEBHOOK_SECRET',
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
  'BILLING_RAZORPAY_KEY_SECRET',
  'BILLING_RAZORPAY_WEBHOOK_SECRET',
  'POSTMARK_SERVER_TOKEN',
  'ANTHROPIC_API_KEY',
  'S3_SECRET_ACCESS_KEY',
] as const;

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    /**
     * "staging": a production build on a test server. Emails go to the local mailbox folder
     * instead of Postmark and the demo seed may run (with passwords from the environment).
     */
    APP_STAGE: z.enum(['production', 'staging']).default('production'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    APP_VERSION: z.string().min(1).default('0.0.0-dev'),
    CORS_ORIGINS: originList.default(['http://localhost:3100', 'http://localhost:3200']),
    /** Express `trust proxy` setting; the Next.js apps call the API from loopback. */
    TRUST_PROXY: z.string().default('loopback'),
    /** RLS-restricted application role. */
    DATABASE_URL: postgresUrl,
    /** BYPASSRLS role — platform admin and background jobs only. */
    DATABASE_URL_PLATFORM: postgresUrl,
    SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
    /** Public base URL of this API (used to build media URLs). */
    PUBLIC_API_URL: z.url().optional(),
    /** Public base URL of the merchant admin (used in emails, e.g. staff invitations). */
    ADMIN_PUBLIC_URL: z.url().default('http://localhost:3100'),
    /** Local directory for the disk storage adapter (uploads, dev mailbox). */
    STORAGE_DIR: z.string().min(1).default('storage'),
    /**
     * Where media is stored: "local" disk (one server) or "s3" (AWS S3, Cloudflare R2,
     * DigitalOcean Spaces, MinIO), which every API instance shares.
     */
    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    S3_BUCKET: z.string().min(3).optional(),
    S3_REGION: z.string().min(1).default('auto'),
    /** Endpoint of an S3-compatible store, e.g. https://<account>.r2.cloudflarestorage.com. */
    S3_ENDPOINT: z.url().optional(),
    S3_ACCESS_KEY_ID: z.string().min(3).optional(),
    S3_SECRET_ACCESS_KEY: z.string().min(8).optional(),
    S3_FORCE_PATH_STYLE: z.enum(['true', 'false']).optional(),
    /** Public CDN base URL for media (e.g. https://cdn.example.com); unset = served by the API. */
    MEDIA_PUBLIC_URL: z.url().optional(),
    /** Error reporting (Sentry). Unset: errors are only logged. */
    SENTRY_DSN: z.url().optional(),
    /** Sentry environment name, e.g. "production" or "staging". */
    SENTRY_ENVIRONMENT: z.string().min(1).optional(),
    EMAIL_FROM: z.string().min(3).default('Commerce Platform <no-reply@localhost>'),
    /** Email adapter: the local mailbox folder (development) or Postmark (production). */
    EMAIL_TRANSPORT: z.enum(['mailbox', 'postmark']).default('mailbox'),
    POSTMARK_SERVER_TOKEN: z.string().min(10).optional(),
    /** Enables the theme editor's AI design assistant (Claude). Unset: the assistant is off. */
    ANTHROPIC_API_KEY: z.string().min(10).optional(),
    /** Claude model for the AI design assistant. */
    THEME_AI_MODEL: z.string().min(1).default('claude-opus-5-5'),
    /** Shared HMAC secret proving storefront requests come from our storefront server. */
    STOREFRONT_SHARED_SECRET: z.string().min(32),
    /** Root domain whose subdomains are stores (port ignored), e.g. "localhost" or "myshops.example". */
    STOREFRONT_ROOT_DOMAIN: z.string().min(1).default('localhost'),
    /** Public storefront URL pattern used in emails; {subdomain} is replaced. */
    STOREFRONT_PUBLIC_URL: z.string().default('http://{subdomain}.localhost:3200'),
    /** Scheme used to build storefront links from the (signed) shopper host. */
    STOREFRONT_PROTOCOL: z.enum(['http', 'https']).default('http'),
    /**
     * Payment gateways merchants can connect, comma-separated: "mock" (sandbox, development only),
     * "stripe", "razorpay". Each store settles through the one it connects.
     */
    PAYMENT_PROVIDERS: gatewayList.optional(),
    /** Deprecated single-gateway form of PAYMENT_PROVIDERS. */
    PAYMENT_PROVIDER: z.enum(GATEWAYS).optional(),
    MOCK_PAYMENT_WEBHOOK_SECRET: z.string().min(16).default('mock-sandbox-webhook-secret'),
    STRIPE_SECRET_KEY: z.string().startsWith('sk_').optional(),
    STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_').optional(),
    /** Signing secret of the Connect webhook endpoint (events from merchants' accounts). */
    STRIPE_CONNECT_WEBHOOK_SECRET: z.string().startsWith('whsec_').optional(),
    /** Razorpay API keys (rzp_test_… in development) and the webhook secret set in its dashboard. */
    RAZORPAY_KEY_ID: z.string().startsWith('rzp_').optional(),
    RAZORPAY_KEY_SECRET: z.string().min(8).optional(),
    RAZORPAY_WEBHOOK_SECRET: z.string().min(8).optional(),
    /**
     * Who charges merchants for their platform subscription: "razorpay" (INR, UPI/card mandates),
     * "stripe", or "mock" (development: plans switch at once with a paid invoice). Default: mock
     * outside production.
     */
    BILLING_PROVIDER: z.enum(['mock', 'stripe', 'razorpay']).optional(),
    /** The platform's own Razorpay account for subscriptions (rzp_test_… in development). */
    BILLING_RAZORPAY_KEY_ID: z.string().startsWith('rzp_').optional(),
    BILLING_RAZORPAY_KEY_SECRET: z.string().min(8).optional(),
    /** Secret of the webhook added in the Razorpay Dashboard for /api/v1/webhooks/billing/razorpay. */
    BILLING_RAZORPAY_WEBHOOK_SECRET: z.string().min(8).optional(),
    /** Days a store keeps working after a subscription payment fails, before billing locks it. */
    BILLING_GRACE_DAYS: z.coerce.number().int().min(0).max(30).default(7),
    /** Where rate-limit counters live: PostgreSQL (shared by all instances) or process memory. */
    RATE_LIMIT_STORE: z.enum(['postgres', 'memory']).default('postgres'),
    /** Unpaid orders release reserved stock after this many minutes. */
    ORDER_PAYMENT_TIMEOUT_MINUTES: z.coerce.number().int().min(5).max(1440).default(30),
    /** Run background jobs (outbox delivery, order expiry) inside this process. */
    RUN_JOBS: z.enum(['true', 'false']).optional(),
    /** How custom-domain ownership is checked: real DNS TXT lookups, or auto-pass (dev/test). */
    DNS_VERIFIER: z.enum(['dns', 'mock']).optional(),
    /** Hostname merchants point their custom domains at (CNAME target). */
    PLATFORM_CNAME_TARGET: z.string().min(1).default('stores.localhost'),
    /** IPv4 address bare domains (example.com) point an A record at, when the platform has one. */
    PLATFORM_APEX_IP: z.ipv4().optional(),
    /** Key material for encrypting secrets at rest and signing short-lived tokens (≥ 32 chars). */
    APP_ENCRYPTION_KEY: z.string().min(32),
    /**
     * Previous encryption keys, comma-separated, still accepted for decryption while a rotation
     * is in progress (see docs/runbook.md, "Rotating APP_ENCRYPTION_KEY").
     */
    APP_ENCRYPTION_KEYS_PREVIOUS: z
      .string()
      .optional()
      .transform((value) =>
        (value ?? '')
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean),
      )
      .pipe(z.array(z.string().min(32))),
    /** Let webhooks reach private/loopback addresses (default: only outside production). */
    WEBHOOK_ALLOW_PRIVATE_URLS: z.enum(['true', 'false']).optional(),
    /** Require platform admins to use two-factor authentication (default: on in production). */
    REQUIRE_PLATFORM_2FA: z.enum(['true', 'false']).optional(),
  })
  .transform(({ PAYMENT_PROVIDER, PAYMENT_PROVIDERS, BILLING_PROVIDER, ...env }) => ({
    ...env,
    PAYMENT_PROVIDERS: PAYMENT_PROVIDERS ?? [PAYMENT_PROVIDER ?? 'mock'],
    BILLING_PROVIDER:
      BILLING_PROVIDER ??
      (env.BILLING_RAZORPAY_KEY_ID
        ? ('razorpay' as const)
        : (PAYMENT_PROVIDERS ?? [PAYMENT_PROVIDER]).includes('stripe') &&
            env.STRIPE_SECRET_KEY &&
            env.STRIPE_WEBHOOK_SECRET
          ? ('stripe' as const)
          : ('mock' as const)),
  }))
  .superRefine((env, ctx) => {
    if (
      env.PAYMENT_PROVIDERS.includes('stripe') &&
      (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET || !env.STRIPE_CONNECT_WEBHOOK_SECRET)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['STRIPE_SECRET_KEY'],
        message:
          'Stripe needs STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET and STRIPE_CONNECT_WEBHOOK_SECRET',
      });
    }
    if (
      env.PAYMENT_PROVIDERS.includes('razorpay') &&
      (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET || !env.RAZORPAY_WEBHOOK_SECRET)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['RAZORPAY_KEY_ID'],
        message: 'Razorpay needs RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET',
      });
    }
    if (
      env.BILLING_PROVIDER === 'razorpay' &&
      (!env.BILLING_RAZORPAY_KEY_ID ||
        !env.BILLING_RAZORPAY_KEY_SECRET ||
        !env.BILLING_RAZORPAY_WEBHOOK_SECRET)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['BILLING_RAZORPAY_KEY_ID'],
        message:
          'Razorpay billing needs BILLING_RAZORPAY_KEY_ID, BILLING_RAZORPAY_KEY_SECRET and BILLING_RAZORPAY_WEBHOOK_SECRET',
      });
    }
    if (
      env.BILLING_PROVIDER === 'stripe' &&
      (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['BILLING_PROVIDER'],
        message: 'Stripe billing needs STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET',
      });
    }
    if (env.NODE_ENV === 'production' && env.BILLING_PROVIDER === 'mock') {
      ctx.addIssue({
        code: 'custom',
        path: ['BILLING_PROVIDER'],
        message:
          'Mock billing would give plans away for free; use razorpay or stripe in production',
      });
    }
    if (env.NODE_ENV === 'production' && env.PAYMENT_PROVIDERS.includes('mock')) {
      ctx.addIssue({
        code: 'custom',
        path: ['PAYMENT_PROVIDERS'],
        message: 'The mock payment provider is not allowed in production',
      });
    }
    if (env.NODE_ENV === 'production') {
      if (env.STOREFRONT_PROTOCOL !== 'https') {
        ctx.addIssue({
          code: 'custom',
          path: ['STOREFRONT_PROTOCOL'],
          message: 'Production storefronts must use https',
        });
      }
      if (!env.PUBLIC_API_URL?.startsWith('https://')) {
        ctx.addIssue({
          code: 'custom',
          path: ['PUBLIC_API_URL'],
          message: 'Set an https PUBLIC_API_URL in production',
        });
      }
      if (!env.ADMIN_PUBLIC_URL.startsWith('https://')) {
        ctx.addIssue({
          code: 'custom',
          path: ['ADMIN_PUBLIC_URL'],
          message: 'Use an https admin URL in production',
        });
      }
    }
    if (
      env.STORAGE_DRIVER === 's3' &&
      (!env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['S3_BUCKET'],
        message: 'STORAGE_DRIVER=s3 needs S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY',
      });
    }
    if (env.EMAIL_TRANSPORT === 'postmark' && !env.POSTMARK_SERVER_TOKEN) {
      ctx.addIssue({
        code: 'custom',
        path: ['POSTMARK_SERVER_TOKEN'],
        message: 'EMAIL_TRANSPORT=postmark needs POSTMARK_SERVER_TOKEN',
      });
    }
    if (
      env.NODE_ENV === 'production' &&
      env.APP_STAGE === 'production' &&
      env.EMAIL_TRANSPORT === 'mailbox'
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['EMAIL_TRANSPORT'],
        message: 'The local mailbox cannot deliver email in production; use postmark',
      });
    }
    // Template placeholders must never reach a running system.
    for (const key of SECRET_KEYS) {
      const value = env[key];
      if (typeof value === 'string' && /CHANGE_?ME/i.test(value)) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: `${key} still contains a CHANGE_ME placeholder; set a real secret`,
        });
      }
    }
    if (env.NODE_ENV === 'production' && env.DNS_VERIFIER === 'mock') {
      ctx.addIssue({
        code: 'custom',
        path: ['DNS_VERIFIER'],
        message: 'Mock DNS verification is not allowed in production',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function allowPrivateWebhooks(env: Env): boolean {
  return env.WEBHOOK_ALLOW_PRIVATE_URLS
    ? env.WEBHOOK_ALLOW_PRIVATE_URLS === 'true'
    : env.NODE_ENV !== 'production';
}

export function requirePlatform2fa(env: Env): boolean {
  return env.REQUIRE_PLATFORM_2FA
    ? env.REQUIRE_PLATFORM_2FA === 'true'
    : env.NODE_ENV === 'production';
}

/** Jobs run in-process by default, except under test where tests drive them explicitly. */
export function shouldRunJobs(env: Env): boolean {
  return env.RUN_JOBS ? env.RUN_JOBS === 'true' : env.NODE_ENV !== 'test';
}

/** Parses and validates configuration; fails fast at startup on invalid values. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // Compose files pass optional settings as `${NAME:-}`: an empty value means "not set".
  const cleaned = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined && value.trim() !== ''),
  );
  const result = envSchema.safeParse(cleaned);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

/** Keys that can decrypt stored secrets: the current one first, then any previous ones. */
export function decryptionKeys(env: Env): string[] {
  return [env.APP_ENCRYPTION_KEY, ...env.APP_ENCRYPTION_KEYS_PREVIOUS];
}
