import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// Prisma 7 no longer loads .env automatically.
if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Migrations run as the schema owner; the API itself connects as the RLS-restricted role.
  datasource: { url: process.env.DATABASE_URL_MIGRATE },
});
