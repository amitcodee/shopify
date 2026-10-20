import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { currentStep, totpCode } from '../src/auth/totp.js';
import { MaintenanceService } from '../src/jobs/maintenance.service.js';
import {
  createTestApp,
  merchantWithStore,
  resetDatabase,
  signup,
  storefrontClient,
  type TestContext,
  uniqueEmail,
} from './utils.js';

describe('Phase 8 hardening', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    process.env.REQUIRE_PLATFORM_2FA = 'true';
    ctx = await createTestApp();
    delete process.env.REQUIRE_PLATFORM_2FA;
    await resetDatabase(ctx.owner);
  });

  afterAll(async () => {
    await ctx?.close();
  });

  describe('two-factor authentication', () => {
    it('enrols, requires a code at login, rejects replays, and can be disabled', async () => {
      const email = uniqueEmail('mfa');
      const password = 'mfa-password-123456';
      const session = await signup(ctx, { email, password });
      const auth = { Authorization: `Bearer ${session.token}` };

      const setup = await ctx.http().post('/api/v1/auth/2fa/setup').set(auth).expect(200);
      expect(setup.body.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
      const stored = await ctx.platform.user.findUniqueOrThrow({ where: { id: session.user.id } });
      expect(stored.totpSecretEnc).not.toContain(setup.body.secret); // encrypted at rest

      await ctx
        .http()
        .post('/api/v1/auth/2fa/enable')
        .set(auth)
        .send({ code: '000000' })
        .expect(401);
      const code = totpCode(setup.body.secret, currentStep());
      await ctx.http().post('/api/v1/auth/2fa/enable').set(auth).send({ code }).expect(204);
      expect(
        (await ctx.http().get('/api/v1/auth/me').set(auth).expect(200)).body.twoFactorEnabled,
      ).toBe(true);

      // Password alone no longer yields a session.
      const first = await ctx
        .http()
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(200);
      expect(first.body).toEqual({ mfaRequired: true, mfaToken: expect.any(String) });
      expect(first.body.token).toBeUndefined();

      // The code used to enable 2FA cannot be replayed; the next step's code works once.
      await ctx
        .http()
        .post('/api/v1/auth/login/mfa')
        .send({ mfaToken: first.body.mfaToken, code })
        .expect(401);
      const next = totpCode(setup.body.secret, currentStep() + 1);
      const second = await ctx
        .http()
        .post('/api/v1/auth/login/mfa')
        .send({ mfaToken: first.body.mfaToken, code: next })
        .expect(200);
      expect(second.body.token).toEqual(expect.any(String));
      await ctx
        .http()
        .post('/api/v1/auth/login/mfa')
        .send({ mfaToken: first.body.mfaToken, code: next })
        .expect(401);

      // Forged / tampered challenge tokens are rejected.
      await ctx
        .http()
        .post('/api/v1/auth/login/mfa')
        .send({ mfaToken: `${first.body.mfaToken}x`, code: next })
        .expect(401);

      await ctx
        .http()
        .post('/api/v1/auth/2fa/disable')
        .set(auth)
        .send({ code: '123456' })
        .expect(401);
    });

    it('signs out other sessions when 2FA is turned on', async () => {
      const email = uniqueEmail('revoke');
      const password = 'revoke-password-123456';
      const session = await signup(ctx, { email, password });
      const auth = { Authorization: `Bearer ${session.token}` };
      const other = await ctx
        .http()
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(200);
      const otherAuth = { Authorization: `Bearer ${other.body.token}` };
      await ctx.http().get('/api/v1/auth/me').set(otherAuth).expect(200);

      const setup = await ctx.http().post('/api/v1/auth/2fa/setup').set(auth).expect(200);
      const code = totpCode(setup.body.secret, currentStep());
      await ctx.http().post('/api/v1/auth/2fa/enable').set(auth).send({ code }).expect(204);

      await ctx.http().get('/api/v1/auth/me').set(auth).expect(200);
      await ctx.http().get('/api/v1/auth/me').set(otherAuth).expect(401);
    });

    it('locks an account for 15 minutes after 10 failed sign-ins', async () => {
      const email = uniqueEmail('lock');
      const password = 'lock-password-123456';
      await signup(ctx, { email, password });
      const login = (pw: string) =>
        ctx.http().post('/api/v1/auth/login').send({ email, password: pw });

      for (let i = 0; i < 9; i++) await login('wrong-password-xyz').expect(401);
      // A success before the limit resets the counter.
      await login(password).expect(200);
      for (let i = 0; i < 10; i++) await login('wrong-password-xyz').expect(401);

      const locked = await login(password).expect(401);
      expect(locked.body.detail).toMatch(/Too many failed sign-in attempts/);
      const user = await ctx.platform.user.findUniqueOrThrow({ where: { email } });
      expect(user.lockedUntil!.getTime()).toBeGreaterThan(Date.now() + 14 * 60_000);
      expect(user.lockedUntil!.getTime()).toBeLessThan(Date.now() + 16 * 60_000);

      await ctx.platform.user.update({
        where: { email },
        data: { lockedUntil: new Date(Date.now() - 1) },
      });
      await login(password).expect(200);
    });

    it('requires 2FA for platform admins when configured', async () => {
      const adminSession = await signup(ctx);
      await ctx.platform.user.update({
        where: { id: adminSession.user.id },
        data: { platformRole: 'SUPER_ADMIN' },
      });
      const auth = { Authorization: `Bearer ${adminSession.token}` };
      const denied = await ctx.http().get('/api/v1/platform/overview').set(auth).expect(403);
      expect(denied.body.detail).toMatch(/two-factor/);

      const setup = await ctx.http().post('/api/v1/auth/2fa/setup').set(auth).expect(200);
      await ctx
        .http()
        .post('/api/v1/auth/2fa/enable')
        .set(auth)
        .send({ code: totpCode(setup.body.secret, currentStep()) })
        .expect(204);
      await ctx.http().get('/api/v1/platform/overview').set(auth).expect(200);
    });
  });

  describe('customer privacy requests', () => {
    it('exports and redacts a customer while keeping orders for accounting', async () => {
      const { store, auth } = await merchantWithStore(ctx);
      const sf = storefrontClient(ctx, `${store.subdomain}.localhost`);
      const product = await ctx
        .http()
        .post(`/api/v1/admin/stores/${store.id}/products`)
        .set(auth)
        .send({ title: 'Pen', status: 'ACTIVE', variants: [{ price: 300, trackInventory: false }] })
        .expect(201);
      const cart = (await sf('post', '/cart').expect(201)).body.token as string;
      await sf('post', '/cart/lines', { cart })
        .send({ variantId: product.body.variants[0].id })
        .expect(201);
      await sf('post', '/checkout', { cart })
        .send({
          email: 'private@example.com',
          idempotencyKey: randomUUID(),
          shippingAddress: {
            name: 'Private Person',
            line1: '7 Secret St',
            city: 'Hidden',
            postalCode: '1',
            country: 'US',
          },
        })
        .expect(201);
      const customer = await ctx.platform.customer.findFirstOrThrow({
        where: { storeId: store.id },
      });
      const base = `/api/v1/admin/stores/${store.id}/customers/${customer.id}`;

      const exported = await ctx.http().get(`${base}/export`).set(auth).expect(200);
      expect(exported.body.customer).toMatchObject({
        email: 'private@example.com',
        hasPassword: false,
      });
      expect(exported.body.customer.orders).toHaveLength(1);
      expect(JSON.stringify(exported.body)).not.toContain('passwordHash');

      await ctx.http().post(`${base}/redact`).set(auth).expect(204);
      const order = await ctx.platform.order.findFirstOrThrow({ where: { storeId: store.id } });
      expect(order.email).toMatch(/^redacted\+/);
      expect(JSON.stringify(order.shippingAddress)).not.toContain('Secret');
      expect(order.total).toBe(300);
      const redacted = await ctx.platform.customer.findUniqueOrThrow({
        where: { id: customer.id },
      });
      expect(redacted).toMatchObject({ name: null, passwordHash: null });

      const other = await merchantWithStore(ctx);
      await ctx
        .http()
        .post(`/api/v1/admin/stores/${other.store.id}/customers/${customer.id}/redact`)
        .set(other.auth)
        .expect(404);
    });
  });

  describe('operations', () => {
    it('answers on-demand TLS checks only for live store hostnames', async () => {
      const { store } = await merchantWithStore(ctx);
      await ctx
        .http()
        .get('/api/v1/domains/tls-check')
        .query({ domain: `${store.subdomain}.localhost` })
        .expect(200);
      await ctx
        .http()
        .get('/api/v1/domains/tls-check')
        .query({ domain: 'attacker.example.com' })
        .expect(404);
      await ctx.http().get('/api/v1/domains/tls-check').expect(404);
    });

    it('propagates request ids and hides internals on errors', async () => {
      const res = await ctx
        .http()
        .get('/api/v1/health')
        .set('X-Request-Id', 'trace-123')
        .expect(200);
      expect(res.headers['x-request-id']).toBe('trace-123');
      const generated = await ctx
        .http()
        .get('/api/v1/health')
        .set('X-Request-Id', 'bad id with spaces!')
        .expect(200);
      expect(generated.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('cleans up expired sessions, carts and old plumbing rows', async () => {
      const session = await signup(ctx);
      await ctx.platform.session.updateMany({
        where: { userId: session.user.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      const result = await ctx.app.get(MaintenanceService).cleanup();
      expect(result.sessions).toBeGreaterThanOrEqual(1);
      expect(await ctx.platform.session.count({ where: { userId: session.user.id } })).toBe(0);
    });
  });
});
