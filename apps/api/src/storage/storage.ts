import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';

/** Port for binary objects (product media); swap the adapter (S3, GCS…) by configuration. */
export interface ObjectStorage {
  put(key: string, data: Buffer, contentType?: string): Promise<void>;
  /** The object's bytes, or null when it does not exist. */
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
}

export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

/** Keys are slash-separated segments of safe characters; no "..", no absolute paths. */
const KEY_PATTERN = /^[A-Za-z0-9_-]+(\.[A-Za-z0-9]+)?(\/[A-Za-z0-9_-]+(\.[A-Za-z0-9]+)?)*$/;

export function isValidKey(key: string): boolean {
  return key.length <= 512 && KEY_PATTERN.test(key);
}

/** Development / single-host adapter: objects are files under `<STORAGE_DIR>`. */
export class LocalDiskStorage implements ObjectStorage {
  private readonly root: string;

  constructor(dir: string) {
    this.root = resolve(dir);
  }

  async put(key: string, data: Buffer): Promise<void> {
    const file = this.path(key);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, data);
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.path(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.path(key), { force: true });
  }

  private path(key: string): string {
    if (!isValidKey(key)) throw new Error(`Invalid storage key: ${key}`);
    const file = resolve(this.root, key);
    // Defense in depth: the pattern already rules out traversal.
    if (!file.startsWith(this.root + sep)) throw new Error(`Invalid storage key: ${key}`);
    return file;
  }
}
