// Promotes a user to platform SUPER_ADMIN in the TEST database (used by E2E tests).
// Usage: node scripts/make-platform-admin.js <email>
import { existsSync } from 'node:fs';
import { createPrismaClient } from '../dist/index.js';

if (existsSync('.env')) process.loadEnvFile('.env');
const url = process.env.TEST_DATABASE_URL_PLATFORM;
const email = process.argv[2];
if (!url || !email) {
  console.error(
    'Usage: node scripts/make-platform-admin.js <email> (needs TEST_DATABASE_URL_PLATFORM)',
  );
  process.exit(1);
}

const db = createPrismaClient(url);
try {
  await db.user.update({
    where: { email: email.toLowerCase() },
    data: { platformRole: 'SUPER_ADMIN' },
  });
} finally {
  await db.$disconnect();
}
