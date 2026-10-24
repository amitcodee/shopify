import {
  Injectable,
  PayloadTooLargeException,
  UnprocessableEntityException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import sharp, { type Metadata } from 'sharp';

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
/** Larger images are scaled down to fit this box. */
export const MAX_IMAGE_SIDE = 5000;
/** Decoding refuses anything larger (decompression bombs). */
const MAX_INPUT_PIXELS = 50_000_000;
/** Widths of the resized copies stored next to each product image (only those below its width). */
export const RENDITION_WIDTHS = [200, 600, 1200, 2048] as const;
const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp', 'gif', 'avif', 'heif']);

export interface ProcessedImage {
  data: Buffer;
  width: number;
  height: number;
  renditions: { width: number; data: Buffer }[];
}

/**
 * Validates uploads by decoding them (not by trusting the filename or Content-Type) and
 * re-encodes to WebP. Re-encoding strips metadata (EXIF/GPS) and neutralizes polyglot files;
 * the EXIF orientation is applied first so photos stay upright. SVG is rejected because it can
 * carry script.
 */
@Injectable()
export class ImageProcessor {
  async process(input: Buffer): Promise<ProcessedImage> {
    if (input.length > MAX_IMAGE_BYTES)
      throw new PayloadTooLargeException('Images must be 20 MB or smaller.');

    let metadata: Metadata | undefined;
    try {
      metadata = await sharp(input, { limitInputPixels: false }).metadata();
    } catch {
      metadata = undefined;
    }
    const format = metadata?.format;
    // sharp reports AVIF as "heif"; other HEIF flavours (HEIC) are not decodable here anyway.
    if (!format || !ALLOWED_FORMATS.has(format) || (format === 'heif' && !isAvif(metadata))) {
      throw new UnsupportedMediaTypeException('Upload a JPEG, PNG, WebP, GIF or AVIF image.');
    }
    if ((metadata?.width ?? 0) * (metadata?.height ?? 0) > MAX_INPUT_PIXELS) {
      throw new PayloadTooLargeException('Images can be at most 50 megapixels.');
    }

    try {
      const { data, info } = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
        .rotate()
        .resize({
          width: MAX_IMAGE_SIDE,
          height: MAX_IMAGE_SIDE,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 82 })
        .toBuffer({ resolveWithObject: true });

      const renditions: ProcessedImage['renditions'] = [];
      // One at a time: large images are memory hungry.
      for (const width of RENDITION_WIDTHS.filter((w) => w < info.width)) {
        renditions.push({
          width,
          data: await sharp(data).resize({ width }).webp({ quality: 82 }).toBuffer(),
        });
      }
      return { data, width: info.width, height: info.height, renditions };
    } catch {
      throw new UnprocessableEntityException('The image could not be read. It may be damaged.');
    }
  }
}

function isAvif(metadata: Metadata | undefined): boolean {
  return (metadata as { compression?: string } | undefined)?.compression === 'av1';
}
