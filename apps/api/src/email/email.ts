import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Port for sending email; swap the adapter (SMTP, SES, Postmark…) by configuration. */
export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

export const EMAIL_SENDER = Symbol('EMAIL_SENDER');

/**
 * Development adapter: never sends real email. Writes each message as JSON into
 * `<STORAGE_DIR>/mailbox` and logs a one-line summary.
 */
export class DevMailboxSender implements EmailSender {
  private readonly logger = new Logger('DevMailbox');

  constructor(
    private readonly dir: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const file = join(
      this.dir,
      `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}.json`,
    );
    await writeFile(file, JSON.stringify({ from: this.from, ...message }, null, 2));
    this.logger.log(`to=${message.to} subject="${message.subject}" saved=${file}`);
  }
}

/**
 * Production adapter for Postmark's HTTP API (no SDK needed). Any transactional provider with a
 * JSON API fits the same shape; a non-2xx answer throws so the outbox retries with backoff.
 */
export class PostmarkEmailSender implements EmailSender {
  constructor(
    private readonly serverToken: string,
    private readonly from: string,
    private readonly endpoint = 'https://api.postmarkapp.com/email',
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': this.serverToken,
      },
      body: JSON.stringify({
        From: this.from,
        To: message.to,
        Subject: message.subject,
        TextBody: message.text,
        HtmlBody: message.html,
        MessageStream: 'outbound',
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 200);
      throw new Error(`Postmark responded ${response.status}: ${detail}`);
    }
  }
}

/** Test adapter: keeps messages in memory. */
export class MemoryEmailSender implements EmailSender {
  readonly sent: EmailMessage[] = [];

  send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
    return Promise.resolve();
  }
}
