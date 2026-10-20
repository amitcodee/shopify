// Prints a sign-up email verification token for a user in the TEST database (used by E2E tests,
// whose API keeps sent email in memory). Mirrors signToken() in apps/api/src/common/crypto.ts.
// Usage: APP_ENCRYPTION_KEY=<the E2E API's key> node scripts/email-verification-token.js <email>
import { createHmac } from 'node:crypto';
import { existsSync } from 'node:fs';
import { createPrismaClient } from '../dist/index.js';

if (existsSync('.env')) process.loadEnvFile('.env');
const url = process.env.TEST_DATABASE_URL_PLATFORM;
const key = process.env.APP_ENCRYPTION_KEY;
const email = process.argv[2];
if (!url || !key || !email) {
  console.error(
    'Usage: node scripts/email-verification-token.js <email> (needs TEST_DATABASE_URL_PLATFORM and APP_ENCRYPTION_KEY)',
  );
  process.exit(1);
}

const db = createPrismaClient(url);
try {
  const user = await db.user.findUniqueOrThrow({ where: { email: email.toLowerCase() } });
  const body = Buffer.from(
    JSON.stringify({
      uid: user.id,
      email: user.email,
      p: 'verify-email',
      exp: Date.now() + 600_000,
    }),
  ).toString('base64url');
  const mac = createHmac('sha256', key).update(body).digest('base64url');
  process.stdout.write(`${body}.${mac}`);
} finally {
  await db.$disconnect();
}
