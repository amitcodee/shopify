import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hashToken } from '../src/auth/session.service.js';
import { signToken } from '../src/common/crypto.js';
import { EMAIL_SENDER, type MemoryEmailSender } from '../src/email/email.js';
import { OutboxProcessor } from '../src/outbox/outbox.service.js';
import {
  createStore,
  createTestApp,
  resetDatabase,
  signup,
  type TestContext,
  uniqueEmail,
} from './utils.js';

/** The verification link only travels by email; read it from the in-memory mailbox. */
function verifyTokenFor(mailbox: MemoryEmailSender, email: string): string {
  const message = mailbox.sent.findLast((m) => m.to === email);
  return /\/verify-email\/([A-Za-z0-9_.-]+)/.exec(message?.text ?? '')?.[1] ?? '';
}

describe('Auth', () => {
  let ctx: TestContext;
  let mailbox: MemoryEmailSender;
  let outbox: OutboxProcessor;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.owner);
    mailbox = (ctx.app as INestApplication).get(EMAIL_SENDER);
    outbox = (ctx.app as INestApplication).get(OutboxProcessor);
  });

  afterAll(async () => {
    await ctx?.close();
  });

  it('signs up, stores only a hashed password and token, and returns the user', async () => {
    const email = uniqueEmail('Signup');
    const session = await signup(ctx, { email: email.toUpperCase() });

    expect(session.user.email).toBe(email.toLowerCase());
    expect(session.user.platformRole).toBe('NONE');

    const user = await ctx.platform.user.findUniqueOrThrow({
      where: { email: email.toLowerCase() },
    });
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    const stored = await ctx.platform.session.findFirstOrThrow({ where: { userId: user.id } });
    expect(stored.tokenHash).toBe(hashToken(session.token));
    expect(stored.tokenHash).not.toBe(session.token);
  });

  it('rejects duplicate emails with 409', async () => {
    const email = uniqueEmail();
    await signup(ctx, { email });
    const res = await ctx
      .http()
      .post('/api/v1/auth/signup')
      .send({ name: 'Dup', email, password: 'another-long-password' });
    expect(res.status).toBe(409);
    expect(res.headers['content-type']).toMatch(/problem\+json/);
  });

  it('validates input and rejects unknown fields', async () => {
    const res = await ctx
      .http()
      .post('/api/v1/auth/signup')
      .send({ name: '', email: 'not-an-email', password: 'short', platformRole: 'SUPER_ADMIN' });
    expect(res.status).toBe(400);
    const paths = (res.body.errors as { path: string }[]).map((e) => e.path);
    expect(paths).toEqual(expect.arrayContaining(['name', 'email', 'password']));
    expect(JSON.stringify(res.body.errors)).toMatch(/platformRole/);
  });

  it('logs in with correct credentials and gives a generic error otherwise', async () => {
    const email = uniqueEmail();
    await signup(ctx, { email, password: 'the-right-password' });

    const ok = await ctx
      .http()
      .post('/api/v1/auth/login')
      .send({ email, password: 'the-right-password' });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toEqual(expect.any(String));

    const wrongPassword = await ctx
      .http()
      .post('/api/v1/auth/login')
      .send({ email, password: 'the-wrong-password' });
    const unknownUser = await ctx
      .http()
      .post('/api/v1/auth/login')
      .send({ email: uniqueEmail('nobody'), password: 'the-wrong-password' });
    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    expect(wrongPassword.body.detail).toBe(unknownUser.body.detail);
  });

  it('requires a valid bearer token for protected routes', async () => {
    await ctx.http().get('/api/v1/auth/me').expect(401);
    await ctx.http().get('/api/v1/auth/me').set('Authorization', 'Bearer nope').expect(401);

    const session = await signup(ctx);
    const me = await ctx
      .http()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${session.token}`)
      .expect(200);
    expect(me.body.id).toBe(session.user.id);
  });

  it('logout revokes the session', async () => {
    const session = await signup(ctx);
    const auth = { Authorization: `Bearer ${session.token}` };
    await ctx.http().post('/api/v1/auth/logout').set(auth).expect(204);
    await ctx.http().get('/api/v1/auth/me').set(auth).expect(401);
  });

  it('rejects expired sessions and disabled users', async () => {
    const expired = await signup(ctx);
    await ctx.platform.session.updateMany({
      where: { userId: expired.user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await ctx
      .http()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${expired.token}`)
      .expect(401);

    const disabled = await signup(ctx);
    await ctx.platform.user.update({
      where: { id: disabled.user.id },
      data: { disabledAt: new Date() },
    });
    await ctx
      .http()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${disabled.token}`)
      .expect(401);
  });

  describe('email verification', () => {
    it('emails a link on sign-up; stores need a verified email', async () => {
      const email = uniqueEmail('verify');
      const session = await signup(ctx, { email, verified: false });
      expect(session.user.emailVerified).toBe(false);
      const auth = { Authorization: `Bearer ${session.token}` };

      const blocked = await ctx
        .http()
        .post('/api/v1/admin/stores')
        .set(auth)
        .send({ name: 'Early', subdomain: `early-${Date.now()}`, contactEmail: email });
      expect(blocked.status).toBe(403);

      await outbox.processBatch();
      const token = verifyTokenFor(mailbox, email);
      expect(token).not.toBe('');
      await ctx.http().post('/api/v1/auth/verify-email').send({ token }).expect(204);
      // Opening the link twice is harmless.
      await ctx.http().post('/api/v1/auth/verify-email').send({ token }).expect(204);

      const me = await ctx.http().get('/api/v1/auth/me').set(auth).expect(200);
      expect(me.body.emailVerified).toBe(true);
      await createStore(ctx, session.token);
    });

    it('rejects tampered, expired and stale links', async () => {
      const email = uniqueEmail('stale');
      const session = await signup(ctx, { email, verified: false });
      const key = process.env.APP_ENCRYPTION_KEY ?? '';
      const verify = (token: string) =>
        ctx.http().post('/api/v1/auth/verify-email').send({ token });

      await outbox.processBatch();
      const token = verifyTokenFor(mailbox, email);
      expect((await verify(`${token.slice(0, -2)}xx`)).status).toBe(400);
      const expired = signToken(key, 'verify-email', { uid: session.user.id, email }, -1000);
      expect((await verify(expired)).status).toBe(400);
      // A link for another purpose (the 2FA login challenge) is not a verification link.
      const wrongPurpose = signToken(key, 'mfa-login', { uid: session.user.id, email }, 60_000);
      expect((await verify(wrongPurpose)).status).toBe(400);
      // A link issued for a previous email address no longer verifies the account.
      const otherEmail = signToken(
        key,
        'verify-email',
        { uid: session.user.id, email: 'old@example.com' },
        60_000,
      );
      expect((await verify(otherEmail)).status).toBe(400);

      const user = await ctx.platform.user.findUniqueOrThrow({ where: { id: session.user.id } });
      expect(user.emailVerifiedAt).toBeNull();
    });

    it('resends a link to unverified users only', async () => {
      const email = uniqueEmail('resend');
      const session = await signup(ctx, { email, verified: false });
      const auth = { Authorization: `Bearer ${session.token}` };
      await outbox.processBatch();
      const before = mailbox.sent.filter((m) => m.to === email).length;

      await ctx.http().post('/api/v1/auth/verify-email/resend').set(auth).expect(204);
      await outbox.processBatch();
      expect(mailbox.sent.filter((m) => m.to === email)).toHaveLength(before + 1);

      await ctx
        .http()
        .post('/api/v1/auth/verify-email')
        .send({ token: verifyTokenFor(mailbox, email) })
        .expect(204);
      await ctx.http().post('/api/v1/auth/verify-email/resend').set(auth).expect(204);
      await outbox.processBatch();
      expect(mailbox.sent.filter((m) => m.to === email)).toHaveLength(before + 1);

      await ctx.http().post('/api/v1/auth/verify-email/resend').expect(401);
    });
  });
});
