// Prints the token of an emailed link for a user in the TEST database (used by E2E tests, whose
// API keeps sent email in memory). Mirrors signToken() in apps/api/src/common/crypto.ts and the
// payloads built in apps/api/src/auth/auth.service.ts.
// Usage: APP_ENCRYPTION_KEY=<the E2E API's key> node scripts/email-link-token.js <purpose> <email>
//   purpose: verify-email | reset-password
import { createHash, createHmac } from 'node:crypto';
import { existsSync } from 'node:fs';
import { createPrismaClient } from '../dist/index.js';

if (existsSync('.env')) process.loadEnvFile('.env');
const url = process.env.TEST_DATABASE_URL_PLATFORM;
const key = process.env.APP_ENCRYPTION_KEY;
const [purpose, email] = process.argv.slice(2);
if (!url || !key || !email || !['verify-email', 'reset-password'].includes(purpose ?? '')) {
  console.error(
    'Usage: node scripts/email-link-token.js <verify-email|reset-password> <email> (needs TEST_DATABASE_URL_PLATFORM and APP_ENCRYPTION_KEY)',
  );
  process.exit(1);
}

const db = createPrismaClient(url);
try {
  const user = await db.user.findUniqueOrThrow({ where: { email: email.toLowerCase() } });
  const payload =
    purpose === 'verify-email'
      ? { uid: user.id, email: user.email }
      : {
          uid: user.id,
          ph: createHash('sha256').update(user.passwordHash).digest('base64url').slice(0, 22),
        };
  const body = Buffer.from(
    JSON.stringify({ ...payload, p: purpose, exp: Date.now() + 600_000 }),
  ).toString('base64url');
  const mac = createHmac('sha256', key).update(body).digest('base64url');
  process.stdout.write(`${body}.${mac}`);
} finally {
  await db.$disconnect();
}
