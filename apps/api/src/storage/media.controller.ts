import { Controller, Get, Inject, NotFoundException, Param, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../auth/auth.guard.js';
import { isValidKey, OBJECT_STORAGE, type ObjectStorage } from './storage.js';

const CONTENT_TYPES: Record<string, string> = { webp: 'image/webp' };

/** Serves stored media. Keys are unguessable UUIDs, so media is public like a CDN. */
@ApiExcludeController()
@Public()
@SkipThrottle()
@Controller('media')
export class MediaController {
  constructor(@Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage) {}

  @Get('*key')
  async get(@Param('key') segments: string[] | string, @Res() res: Response): Promise<void> {
    const key = Array.isArray(segments) ? segments.join('/') : segments;
    const type = CONTENT_TYPES[key.slice(key.lastIndexOf('.') + 1)];
    if (!type || !isValidKey(key)) throw new NotFoundException();
    const data = await this.storage.get(key);
    if (!data) throw new NotFoundException();
    res
      .status(200)
      .set({
        'Content-Type': type,
        'Content-Length': String(data.length),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        // Storefronts on other origins embed these images.
        'Cross-Origin-Resource-Policy': 'cross-origin',
      })
      .end(data);
  }
}
