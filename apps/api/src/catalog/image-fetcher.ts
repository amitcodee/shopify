import { Injectable } from '@nestjs/common';
import { MAX_IMAGE_BYTES } from '../storage/image-processor.js';
import { fetchImage } from '../webhooks/safe-http.js';

/**
 * Downloads product images from merchant-supplied URLs through the SSRF-safe client (https
 * only, public addresses only, at most 3 redirects, 15 s, 20 MB). A provider of its own so
 * tests can stand in for the network.
 */
@Injectable()
export class RemoteImageFetcher {
  async fetch(url: string): Promise<Buffer> {
    const { data } = await fetchImage(url, {
      maxBytes: MAX_IMAGE_BYTES,
      timeoutMs: 15_000,
      maxRedirects: 3,
    });
    return data;
  }
}
