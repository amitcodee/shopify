/**
 * Re-encrypts every secret stored at rest with the current APP_ENCRYPTION_KEY.
 *
 * Rotation (docs/runbook.md): set the new key as APP_ENCRYPTION_KEY and the old one in
 * APP_ENCRYPTION_KEYS_PREVIOUS, deploy (everything keeps working: old values still decrypt), run
 * `node dist/rotate-encryption-key.js`, then remove the old key from APP_ENCRYPTION_KEYS_PREVIOUS.
 * Safe to run more than once; values already on the current key are rewritten unchanged in meaning.
 *
 * Covers: merchants' gateway API keys, staff two-factor seeds, storefront passwords and webhook
 * signing secrets.
 */
import { existsSync } from 'node:fs';
import { createPrismaClient } from '@repo/db';
import { decryptSecret, encryptSecret } from './common/crypto.js';
import { decryptionKeys, loadEnv } from './config/env.js';

async function main(): Promise<void> {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const env = loadEnv();
  const keys = decryptionKeys(env);
  const db = createPrismaClient(env.DATABASE_URL_PLATFORM);
  const reseal = (value: string) =>
    encryptSecret(env.APP_ENCRYPTION_KEY, decryptSecret(keys, value));
  const counts = { gateways: 0, totp: 0, storefrontPasswords: 0, webhooks: 0, failed: 0 };

  try {
    for (const row of await db.storeGateway.findMany({
      select: { id: true, credentialsEnc: true },
    })) {
      try {
        await db.storeGateway.update({
          where: { id: row.id },
          data: { credentialsEnc: reseal(row.credentialsEnc) },
        });
        counts.gateways++;
      } catch {
        counts.failed++;
        console.error(`Could not re-encrypt store gateway ${row.id}`);
      }
    }
    for (const row of await db.user.findMany({
      where: { totpSecretEnc: { not: null } },
      select: { id: true, totpSecretEnc: true },
    })) {
      try {
        await db.user.update({
          where: { id: row.id },
          data: { totpSecretEnc: reseal(row.totpSecretEnc!) },
        });
        counts.totp++;
      } catch {
        counts.failed++;
        console.error(`Could not re-encrypt the two-factor seed of user ${row.id}`);
      }
    }
    for (const row of await db.store.findMany({
      where: { storefrontPasswordEncrypted: { not: null } },
      select: { id: true, storefrontPasswordEncrypted: true },
    })) {
      try {
        await db.store.update({
          where: { id: row.id },
          data: { storefrontPasswordEncrypted: reseal(row.storefrontPasswordEncrypted!) },
        });
        counts.storefrontPasswords++;
      } catch {
        counts.failed++;
        console.error(`Could not re-encrypt the storefront password of store ${row.id}`);
      }
    }
    for (const row of await db.webhookSubscription.findMany({
      select: { id: true, secretEncrypted: true },
    })) {
      try {
        await db.webhookSubscription.update({
          where: { id: row.id },
          data: { secretEncrypted: reseal(row.secretEncrypted) },
        });
        counts.webhooks++;
      } catch {
        counts.failed++;
        console.error(`Could not re-encrypt webhook subscription ${row.id}`);
      }
    }
  } finally {
    await db.$disconnect();
  }
  console.log(`Re-encrypted: ${JSON.stringify(counts)}`);
  if (counts.failed > 0) {
    console.error(
      'Some values could not be decrypted with any configured key; keep the previous keys and investigate.',
    );
    process.exitCode = 1;
  }
}

void main();
