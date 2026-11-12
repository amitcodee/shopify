import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { ObjectStorage } from './storage.js';

export interface S3StorageOptions {
  bucket: string;
  region: string;
  /** For S3-compatible stores (Cloudflare R2, DigitalOcean Spaces, MinIO). */
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** MinIO and some providers need path-style URLs. */
  forcePathStyle?: boolean;
}

/**
 * S3-compatible object storage, so any number of API instances share media. Keys are the same as
 * on local disk; images are immutable (new uploads get new keys) and cached for a year.
 */
export class S3Storage implements ObjectStorage {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(options: S3StorageOptions, client?: S3Client) {
    this.bucket = options.bucket;
    this.client =
      client ??
      new S3Client({
        region: options.region,
        endpoint: options.endpoint,
        forcePathStyle: options.forcePathStyle,
        credentials: {
          accessKeyId: options.accessKeyId,
          secretAccessKey: options.secretAccessKey,
        },
      });
  }

  async put(key: string, data: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (!result.Body) return null;
      return Buffer.from(await result.Body.transformToByteArray());
    } catch (error) {
      if (error instanceof NoSuchKey || (error as { name?: string }).name === 'NoSuchKey') {
        return null;
      }
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async deletePrefix(prefix: string): Promise<void> {
    if (!/^stores\/[0-9a-f-]{36}\/$/.test(prefix)) throw new Error('Invalid storage prefix');
    let token: string | undefined;
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }),
      );
      const keys = (page.Contents ?? []).flatMap((o) => (o.Key ? [{ Key: o.Key }] : []));
      if (keys.length > 0) {
        await this.client.send(
          new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: keys, Quiet: true } }),
        );
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
  }
}
