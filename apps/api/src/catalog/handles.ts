import { slugify } from '@repo/contracts';

/**
 * Returns `preferred` (or a slug of `fallbackSource`) made unique with a numeric suffix,
 * using `exists` to check the per-store unique index.
 */
export async function uniqueHandle(
  preferred: string | undefined,
  fallbackSource: string,
  exists: (handle: string) => Promise<boolean>,
): Promise<string> {
  const base = preferred ?? (slugify(fallbackSource) || 'item');
  if (!(await exists(base))) return base;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base.slice(0, 110)}-${n}`;
    if (!(await exists(candidate))) return candidate;
  }
  throw new Error('Could not find a free handle');
}
