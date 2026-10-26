// Copies the shared photo library in packages/assets into the apps' static `public/` folders.
// Run from anywhere: `node scripts/sync-assets.mjs`. Each target folder is replaced wholesale,
// so files deleted from packages/assets disappear from the apps too. No dependencies.
import { cpSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = path.join(root, 'packages', 'assets');

/** [source folder in packages/assets, destination folders relative to the repo root] */
const COPIES = [
  ['templates', ['apps/storefront/public/media/templates', 'apps/admin/public/media/templates']],
  ['marketing', ['apps/storefront/public/media/marketing']],
];

for (const [source, destinations] of COPIES) {
  const from = path.join(assets, source);
  if (!existsSync(from)) throw new Error(`Missing ${path.relative(root, from)}`);
  for (const destination of destinations) {
    const to = path.join(root, destination);
    rmSync(to, { recursive: true, force: true });
    cpSync(from, to, { recursive: true, filter: (file) => !file.endsWith('.md') });
    console.log(`synced packages/assets/${source} -> ${destination}`);
  }
}
