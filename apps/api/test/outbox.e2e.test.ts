import type { INestApplication } from '@nestjs/common';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { EMAIL_SENDER, type MemoryEmailSender } from '../src/email/email.js';
import { OutboxProcessor } from '../src/outbox/outbox.service.js';
import { createTestApp, resetDatabase, type TestContext } from './utils.js';

describe('Outbox delivery', () => {
  let ctx: TestContext;
  let mailbox: MemoryEmailSender;
  let outbox: OutboxProcessor;

  const enqueue = (count: number) =>
    ctx.platform.outboxMessage.createMany({
      data: Array.from({ length: count }, (_, i) => ({
        type: 'email',
        payload: { to: `shopper${i}@example.com`, subject: `Message ${i}`, text: 'Body' },
      })),
    });

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.owner);
    mailbox = (ctx.app as INestApplication).get(EMAIL_SENDER);
    outbox = (ctx.app as INestApplication).get(OutboxProcessor);
  });

  beforeEach(async () => {
    await ctx.platform.outboxMessage.deleteMany();
    mailbox.sent.length = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await ctx?.close();
  });

  it('sends each message once when workers run at the same time', async () => {
    await enqueue(10);

    const attempted = await Promise.all([outbox.processBatch(), outbox.processBatch()]);

    expect(attempted[0] + attempted[1]).toBe(10);
    expect(mailbox.sent.map((m) => m.to).sort()).toHaveLength(10);
    expect(new Set(mailbox.sent.map((m) => m.to)).size).toBe(10);
    const rows = await ctx.platform.outboxMessage.findMany();
    expect(rows.every((r) => r.status === 'SENT' && r.attempts === 1)).toBe(true);
  });

  it('hides a message from other workers while it is being sent', async () => {
    await enqueue(1);
    let seenByOtherWorker = -1;
    const send = mailbox.send.bind(mailbox);
    vi.spyOn(mailbox, 'send').mockImplementation(async (message) => {
      // Runs mid-send: this would block or see the row if a transaction were being held badly.
      seenByOtherWorker = await outbox.processBatch();
      await send(message);
    });

    await outbox.processBatch();

    expect(seenByOtherWorker).toBe(0);
    expect(mailbox.sent).toHaveLength(1);
  });

  it('keeps earlier sends when a later one fails, and retries only the failure', async () => {
    await enqueue(2);
    const send = mailbox.send.bind(mailbox);
    const spy = vi.spyOn(mailbox, 'send');
    spy.mockImplementationOnce((message) => send(message));
    spy.mockImplementationOnce(() => Promise.reject(new Error('mail server down')));

    expect(await outbox.processBatch()).toBe(2);

    const rows = await ctx.platform.outboxMessage.findMany({ orderBy: { status: 'asc' } });
    const sent = rows.filter((r) => r.status === 'SENT');
    const pending = rows.filter((r) => r.status === 'PENDING');
    expect(sent).toHaveLength(1);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.attempts).toBe(1);
    expect(pending[0]?.lastError).toContain('mail server down');
    expect(pending[0]?.availableAt.getTime()).toBeGreaterThan(Date.now());
    expect(await outbox.processBatch()).toBe(0);
  });

  it('removes the body of a sent message', async () => {
    await enqueue(1);

    await outbox.processBatch();

    const [row] = await ctx.platform.outboxMessage.findMany();
    expect(row?.payload).toEqual({ subject: 'Message 0', scrubbed: true });
  });
});
