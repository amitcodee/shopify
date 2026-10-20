import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type AuthSession, STOREFRONT_HEADERS, type StoreSummary } from '@repo/contracts';
import { createPrismaClient, type PrismaClient } from '@repo/db';
import request from 'supertest';
import { expect } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { loadEnv } from '../src/config/env.js';
import { configureApp } from '../src/configure-app.js';
import { signStorefrontRequest } from '../src/storefront/storefront.guard.js';

export interface TestContext {
  app: INestApplication<Server>;
  http: () => ReturnType<typeof request>;
  /** Schema-owner client for arranging fixtures and truncating; bypasses nothing at runtime. */
  owner: PrismaClient;
  /** BYPASSRLS client for direct assertions. */
  platform: PrismaClient;
  close: () => Promise<void>;
}

export async function createTestApp(): Promise<TestContext> {
  const env = loadEnv({ ...process.env, CORS_ORIGINS: 'http://localhost:3100' });
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.register(env)],
  }).compile();
  const app = moduleRef.createNestApplication<INestApplication<Server>>({ rawBody: true });
  configureApp(app, env);
  await app.init();

  const owner = createPrismaClient(process.env.DATABASE_URL_MIGRATE ?? '');
  const platform = createPrismaClient(env.DATABASE_URL_PLATFORM);
  return {
    app,
    http: () => request(app.getHttpServer()),
    owner,
    platform,
    close: async () => {
      await app.close();
      await Promise.all([owner.$disconnect(), platform.$disconnect()]);
    },
  };
}

/** Empties every application table (keeps migration history). */
export async function resetDatabase(owner: PrismaClient): Promise<void> {
  const tables = await owner.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  await owner.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

export function uniqueEmail(prefix = 'user'): string {
  return `${prefix}-${randomUUID().slice(0, 8)}@example.com`;
}

/** Signs up a user. Pass `verified: false` to skip confirming the email (required for stores). */
export async function signup(
  ctx: TestContext,
  overrides: Partial<{ name: string; email: string; password: string; verified: boolean }> = {},
): Promise<AuthSession> {
  const { verified = true, ...fields } = overrides;
  const res = await ctx
    .http()
    .post('/api/v1/auth/signup')
    .send({
      name: 'Test Merchant',
      email: uniqueEmail(),
      password: 'correct-horse-battery',
      ...fields,
    });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  const session = res.body as AuthSession;
  if (verified) {
    await ctx.platform.user.update({
      where: { id: session.user.id },
      data: { emailVerifiedAt: new Date() },
    });
    session.user.emailVerified = true;
  }
  return session;
}

/** Creates a store with sandbox payments connected; pass `payments: false` to skip that. */
export async function createStore(
  ctx: TestContext,
  token: string,
  overrides: Partial<{ name: string; subdomain: string; currency: string; payments: boolean }> = {},
): Promise<StoreSummary> {
  const { payments = true, ...fields } = overrides;
  const res = await ctx
    .http()
    .post('/api/v1/admin/stores')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'Test Store',
      subdomain: `store-${randomUUID().slice(0, 8)}`,
      contactEmail: 'owner@example.com',
      ...fields,
    });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  const store = res.body as StoreSummary;
  if (payments) await enablePayments(ctx, store.id, token);
  return store;
}

/** Connects a sandbox payout account and completes its onboarding. */
export async function enablePayments(
  ctx: TestContext,
  storeId: string,
  token: string,
  outcome: 'complete' | 'restricted' = 'complete',
): Promise<void> {
  const auth = { Authorization: `Bearer ${token}` };
  const base = `/api/v1/admin/stores/${storeId}/payments`;
  const connect = await ctx.http().post(`${base}/account`).set(auth).send({ country: 'US' });
  expect(connect.status, JSON.stringify(connect.body)).toBe(200);
  const done = await ctx.http().post(`${base}/sandbox-onboarding`).set(auth).send({ outcome });
  expect(done.status, JSON.stringify(done.body)).toBe(200);
}

/** Signs up a fresh merchant with one store. */
export async function merchantWithStore(ctx: TestContext) {
  const session = await signup(ctx);
  const store = await createStore(ctx, session.token);
  const auth = { Authorization: `Bearer ${session.token}` };
  return { session, store, auth, token: session.token };
}

type Method = 'get' | 'post' | 'patch' | 'delete';

/** Storefront API client that signs requests for `host` like the storefront server does. */
export function storefrontClient(ctx: TestContext, host: string) {
  const secret = process.env.STOREFRONT_SHARED_SECRET ?? '';
  return (method: Method, path: string, tokens: { cart?: string; customer?: string } = {}) => {
    const ts = String(Date.now());
    const agent = ctx.http();
    const req = agent[method](`/api/v1/storefront${path}`)
      .set(STOREFRONT_HEADERS.host, host)
      .set(STOREFRONT_HEADERS.timestamp, ts)
      .set(STOREFRONT_HEADERS.signature, signStorefrontRequest(secret, host, ts));
    if (tokens.cart) req.set(STOREFRONT_HEADERS.cart, tokens.cart);
    if (tokens.customer) req.set(STOREFRONT_HEADERS.customer, tokens.customer);
    return req;
  };
}

/** Completes a sandbox payment from the `paymentUrl` returned by checkout. */
export function payMock(
  sf: ReturnType<typeof storefrontClient>,
  paymentUrl: string,
  outcome: 'succeed' | 'fail' = 'succeed',
) {
  const reference = paymentUrl.split('/checkout/pay/')[1] ?? '';
  return sf('post', `/checkout/mock-payments/${reference}`).send({ outcome }).expect(200);
}
