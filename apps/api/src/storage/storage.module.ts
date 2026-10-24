import { Global, Inject, Injectable, Module } from '@nestjs/common';
import { ENV, type Env } from '../config/env.js';
import { ImageProcessor } from './image-processor.js';
import { MediaController } from './media.controller.js';
import { LocalDiskStorage, OBJECT_STORAGE } from './storage.js';

/** Builds public URLs for stored objects (served by MediaController, or a CDN in front of it). */
@Injectable()
export class MediaUrls {
  private readonly base: string;

  constructor(@Inject(ENV) env: Env) {
    const origin = env.PUBLIC_API_URL ?? `http://localhost:${env.API_PORT}`;
    this.base = `${origin.replace(/\/$/, '')}/api/v1/media/`;
  }

  url(key: string): string {
    return this.base + key;
  }
}

@Global()
@Module({
  controllers: [MediaController],
  providers: [
    {
      provide: OBJECT_STORAGE,
      inject: [ENV],
      useFactory: (env: Env) => new LocalDiskStorage(env.STORAGE_DIR),
    },
    ImageProcessor,
    MediaUrls,
  ],
  exports: [OBJECT_STORAGE, ImageProcessor, MediaUrls],
})
export class StorageModule {}
