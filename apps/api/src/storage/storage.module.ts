import { Global, Injectable, Inject, Module } from '@nestjs/common';
import { ENV, type Env } from '../config/env.js';
import { ImageProcessor } from './image-processor.js';
import { MediaController } from './media.controller.js';
import { S3Storage } from './s3-storage.js';
import { LocalDiskStorage, OBJECT_STORAGE, type ObjectStorage } from './storage.js';

@Injectable()
export class MediaUrls {
  private readonly base: string;

  constructor(@Inject(ENV) env: Env) {
    // With a CDN in front of the bucket, images load from it directly; otherwise the API serves
    // them from storage.
    this.base = env.MEDIA_PUBLIC_URL
      ? env.MEDIA_PUBLIC_URL.replace(/\/+$/, '')
      : `${env.PUBLIC_API_URL ?? `http://localhost:${env.API_PORT}`}/api/v1/media`;
  }

  url(key: string): string {
    return `${this.base}/${key}`;
  }
}

export function createObjectStorage(env: Env): ObjectStorage {
  if (env.STORAGE_DRIVER === 's3') {
    return new S3Storage({
      bucket: env.S3_BUCKET!,
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      accessKeyId: env.S3_ACCESS_KEY_ID!,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
      forcePathStyle: env.S3_FORCE_PATH_STYLE === 'true',
    });
  }
  return new LocalDiskStorage(env.STORAGE_DIR);
}

@Global()
@Module({
  controllers: [MediaController],
  providers: [
    {
      provide: OBJECT_STORAGE,
      inject: [ENV],
      useFactory: createObjectStorage,
    },
    ImageProcessor,
    MediaUrls,
  ],
  exports: [OBJECT_STORAGE, ImageProcessor, MediaUrls],
})
export class StorageModule {}
