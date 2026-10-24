import { Injectable, UnsupportedMediaTypeException } from '@nestjs/common';
import sharp from 'sharp';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Raster formats we accept; anything else (SVG, PDF, HEIC…) is rejected before decoding. */
const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp', 'gif', 'avif', 'tiff']);
const MAX_DIMENSION = 2048;
const MAX_INPUT_PIXELS = 50_000_000;

export interface ProcessedImage {
  data: Buffer;
  width: number;
  height: number;
}

/**
 * Re-encodes uploads to WebP: strips metadata (EXIF, GPS), applies orientation, caps the size.
 * The stored file is never the uploaded bytes, so a polyglot upload cannot be served back.
 */
@Injectable()
export class ImageProcessor {
  async process(file: Buffer): Promise<ProcessedImage> {
    let format: string | undefined;
    try {
      ({ format } = await sharp(file, { limitInputPixels: MAX_INPUT_PIXELS }).metadata());
    } catch {
      throw new UnsupportedMediaTypeException('The file is not a supported image.');
    }
    if (!format || !ACCEPTED_FORMATS.has(format)) {
      throw new UnsupportedMediaTypeException('Upload a JPEG, PNG, WebP, GIF or AVIF image.');
    }
    try {
      const { data, info } = await sharp(file, { limitInputPixels: MAX_INPUT_PIXELS })
        .rotate()
        .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer({ resolveWithObject: true });
      return { data, width: info.width, height: info.height };
    } catch {
      throw new UnsupportedMediaTypeException('The image could not be decoded.');
    }
  }
}
