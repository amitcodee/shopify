import { Controller, Get, Inject, NotFoundException, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../auth/auth.guard.js';
import { MEDIA_KEY, OBJECT_STORAGE, type ObjectStorage } from './storage.js';

/** Serves uploaded media from the storage adapter (a CDN would front this in production). */
@ApiExcludeController()
@Public()
@SkipThrottle()
@Controller('media')
export class MediaController {
  constructor(@Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage) {}

  @Get('*key')
  async get(@Req() req: Request, @Res() res: Response): Promise<void> {
    const raw = (req.params as Record<string, string | string[]>).key;
    const key = Array.isArray(raw) ? raw.join('/') : (raw ?? '');
    if (!MEDIA_KEY.test(key)) throw new NotFoundException();

    const data = await this.storage.get(key);
    if (!data) throw new NotFoundException();

    res
      .status(200)
      .type('image/webp')
      .set({
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Cross-Origin-Resource-Policy': 'cross-origin',
      })
      .send(data);
  }
}
