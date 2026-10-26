import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';

/** Port for binary object storage (local disk in development, S3-compatible in production). */
export interface ObjectStorage {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
}

export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

/** Keys are generated server-side only; this pattern also blocks path traversal on reads. */
export const MEDIA_KEY =
  /^stores\/[0-9a-f-]{36}\/(products|branding)\/[0-9a-f-]{36}(?:_w\d{2,4})?\.webp$/;

/** Key of an image's resized copy: `…/<id>.webp` -> `…/<id>_w600.webp`. */
export function renditionKey(key: string, width: number): string {
  return key.replace(/\.webp$/, `_w${width}.webp`);
}

/** The stored object and all of its renditions (what to delete with the image). */
export function imageKeys(image: { storageKey: string; renditionWidths: number[] }): string[] {
  return [image.storageKey, ...image.renditionWidths.map((w) => renditionKey(image.storageKey, w))];
}

export class LocalDiskStorage implements ObjectStorage {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  private pathFor(key: string): string {
    const full = resolve(join(this.root, key));
    if (!full.startsWith(this.root + sep)) throw new Error('Invalid storage key');
    return full;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.pathFor(key));
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }
}
