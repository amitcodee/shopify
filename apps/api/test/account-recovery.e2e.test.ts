import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EMAIL_SENDER, type MemoryEmailSender } from '../src/email/email.js';
import { OutboxProcessor } from '../src/outbox/outbox.service.js';
import { createTestApp, resetDatabase, signup, type TestContext, uniqueEmail } from './utils.js';

describe('Account recovery (password reset, unlock)', () => {
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

  /** Delivers queued email and returns the token in the latest `/<path>/<token>` link. */
  async function linkToken(email: string, path: 'reset-password' | 'unlock'): Promise<string> {
    while ((await outbox.processBatch()) > 0);
    const message = mailbox.sent.findLast((m) => m.to === email && m.text.includes(`/${path}/`));
    return new RegExp(`/${path}/([A-Za-z0-9_.-]+)`).exec(message?.text ?? '')?.[1] ?? '';
  }

  const login = (email: string, password: string) =>
    ctx.http().post('/api/v1/auth/login').send({ email, password });

  it('resets the password from an emailed single-use link and signs out everywhere', async () => {
    const email = uniqueEmail('reset');
    const session = await signup(ctx, { email, password: 'old-password-123456' });
    const auth = { Authorization: `Bearer ${session.token}` };

    await ctx.http().post('/api/v1/auth/password/forgot').send({ email }).expect(204);
    const token = await linkToken(email, 'reset-password');
    expect(token).not.toBe('');

    await ctx
      .http()
      .post('/api/v1/auth/password/reset')
      .send({ token, password: 'short' })
      .expect(400);
    await ctx
      .http()
      .post('/api/v1/auth/password/reset')
      .send({ token, password: 'new-password-123456' })
      .expect(204);

    await ctx.http().get('/api/v1/auth/me').set(auth).expect(401);
    await login(email, 'old-password-123456').expect(401);
    await login(email, 'new-password-123456').expect(200);

    // The link was bound to the old password: it cannot be used again.
    const reused = await ctx
      .http()
      .post('/api/v1/auth/password/reset')
      .send({ token, password: 'another-password-123' })
      .expect(400);
    expect(reused.body.detail).toBe('This password reset link is invalid or has expired.');
  });

  it('answers the same for unknown emails and sends nothing', async () => {
    const before = mailbox.sent.length;
    await ctx
      .http()
      .post('/api/v1/auth/password/forgot')
      .send({ email: uniqueEmail('nobody') })
      .expect(204);
    while ((await outbox.processBatch()) > 0);
    expect(mailbox.sent.length).toBe(before);
  });

  it('emails an unlock link when an account is locked; it works once', async () => {
    const email = uniqueEmail('unlock');
    const password = 'unlock-password-123456';
    await signup(ctx, { email, password });

    for (let i = 0; i < 10; i++) await login(email, 'wrong-password-xyz').expect(401);
    const locked = await login(email, password).expect(401);
    expect(locked.body.detail).toMatch(/emailed you a link to unlock/);

    const token = await linkToken(email, 'unlock');
    const lockEmail = mailbox.sent.findLast((m) => m.to === email);
    expect(lockEmail?.subject).toBe('Your account was locked');
    expect(lockEmail?.text).toContain('/reset-password/');

    await ctx.http().post('/api/v1/auth/unlock').send({ token }).expect(204);
    await login(email, password).expect(200);
    await ctx.http().post('/api/v1/auth/unlock').send({ token }).expect(400);
  });

  it('rejects tampered links and links of another purpose', async () => {
    const email = uniqueEmail('tamper');
    await signup(ctx, { email });
    await ctx.http().post('/api/v1/auth/password/forgot').send({ email }).expect(204);
    const token = await linkToken(email, 'reset-password');

    await ctx.http().post('/api/v1/auth/unlock').send({ token }).expect(400);
    await ctx
      .http()
      .post('/api/v1/auth/password/reset')
      .send({ token: `${token.slice(0, -2)}xx`, password: 'new-password-123456' })
      .expect(400);
  });
});
