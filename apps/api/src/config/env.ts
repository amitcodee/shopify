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

const SECRET_KEYS = [
  'DATABASE_URL',
  'DATABASE_URL_PLATFORM',
  'STOREFRONT_SHARED_SECRET',
  'APP_ENCRYPTION_KEY',
  'MOCK_PAYMENT_WEBHOOK_SECRET',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_CONNECT_WEBHOOK_SECRET',
  'POSTMARK_SERVER_TOKEN',
] as const;

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
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
    EMAIL_FROM: z.string().min(3).default('Commerce Platform <no-reply@localhost>'),
    /** Email adapter: the local mailbox folder (development) or Postmark (production). */
    EMAIL_TRANSPORT: z.enum(['mailbox', 'postmark']).default('mailbox'),
    POSTMARK_SERVER_TOKEN: z.string().min(10).optional(),
    /** Shared HMAC secret proving storefront requests come from our storefront server. */
    STOREFRONT_SHARED_SECRET: z.string().min(32),
    /** Root domain whose subdomains are stores (port ignored), e.g. "localhost" or "myshops.example". */
    STOREFRONT_ROOT_DOMAIN: z.string().min(1).default('localhost'),
    /** Public storefront URL pattern used in emails; {subdomain} is replaced. */
    STOREFRONT_PUBLIC_URL: z.string().default('http://{subdomain}.localhost:3200'),
    /** Scheme used to build storefront links from the (signed) shopper host. */
    STOREFRONT_PROTOCOL: z.enum(['http', 'https']).default('http'),
    /** Payment adapter: the sandbox simulator or Stripe (test keys in development). */
    PAYMENT_PROVIDER: z.enum(['mock', 'stripe']).default('mock'),
    MOCK_PAYMENT_WEBHOOK_SECRET: z.string().min(16).default('mock-sandbox-webhook-secret'),
    STRIPE_SECRET_KEY: z.string().startsWith('sk_').optional(),
    STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_').optional(),
    /** Signing secret of the Connect webhook endpoint (events from merchants' accounts). */
    STRIPE_CONNECT_WEBHOOK_SECRET: z.string().startsWith('whsec_').optional(),
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
    /** Key material for encrypting secrets at rest and signing short-lived tokens (≥ 32 chars). */
    APP_ENCRYPTION_KEY: z.string().min(32),
    /** Require platform admins to use two-factor authentication (default: on in production). */
    REQUIRE_PLATFORM_2FA: z.enum(['true', 'false']).optional(),
  })
  .superRefine((env, ctx) => {
    if (
      env.PAYMENT_PROVIDER === 'stripe' &&
      (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET || !env.STRIPE_CONNECT_WEBHOOK_SECRET)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['STRIPE_SECRET_KEY'],
        message:
          'Stripe needs STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET and STRIPE_CONNECT_WEBHOOK_SECRET',
      });
    }
    if (env.NODE_ENV === 'production' && env.PAYMENT_PROVIDER === 'mock') {
      ctx.addIssue({
        code: 'custom',
        path: ['PAYMENT_PROVIDER'],
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
    if (env.EMAIL_TRANSPORT === 'postmark' && !env.POSTMARK_SERVER_TOKEN) {
      ctx.addIssue({
        code: 'custom',
        path: ['POSTMARK_SERVER_TOKEN'],
        message: 'EMAIL_TRANSPORT=postmark needs POSTMARK_SERVER_TOKEN',
      });
    }
    if (env.NODE_ENV === 'production' && env.EMAIL_TRANSPORT === 'mailbox') {
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
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
