import { join } from 'node:path';
import { Global, Module } from '@nestjs/common';
import { ENV, type Env } from '../config/env.js';
import {
  DevMailboxSender,
  EMAIL_SENDER,
  type EmailSender,
  MemoryEmailSender,
  PostmarkEmailSender,
} from './email.js';

export function createEmailSender(env: Env): EmailSender {
  if (env.NODE_ENV === 'test') return new MemoryEmailSender();
  if (env.EMAIL_TRANSPORT === 'postmark') {
    // Presence is enforced by the env schema.
    return new PostmarkEmailSender(env.POSTMARK_SERVER_TOKEN ?? '', env.EMAIL_FROM);
  }
  return new DevMailboxSender(join(env.STORAGE_DIR, 'mailbox'), env.EMAIL_FROM);
}

@Global()
@Module({
  providers: [{ provide: EMAIL_SENDER, inject: [ENV], useFactory: createEmailSender }],
  exports: [EMAIL_SENDER],
})
export class EmailModule {}
