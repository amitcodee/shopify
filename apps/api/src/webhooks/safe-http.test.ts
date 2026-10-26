import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  fetchImage,
  isBlockedAddress,
  postJson,
  RemoteFetchError,
  UnsafeUrlError,
} from './safe-http.js';

describe('isBlockedAddress', () => {
  it('blocks loopback, private, link-local, metadata and mapped addresses', () => {
    for (const address of [
      '127.0.0.1',
      '10.1.2.3',
      '172.20.0.5',
      '192.168.1.1',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
      '::1',
      'fd00::1',
      'fe80::1',
      '::ffff:127.0.0.1',
      'not-an-ip',
    ]) {
      expect(isBlockedAddress(address), address).toBe(true);
    }
    for (const address of ['93.184.216.34', '1.1.1.1', '2606:4700:4700::1111']) {
      expect(isBlockedAddress(address), address).toBe(false);
    }
  });
});

describe('postJson', () => {
  let server: Server;
  let url: string;
  const received: { body: string; signature: string | undefined }[] = [];

  beforeAll(async () => {
    server = createServer((req, res) => {
      let body = '';
      req.on('data', (chunk: Buffer) => (body += chunk.toString()));
      req.on('end', () => {
        received.push({ body, signature: req.headers['x-test'] as string | undefined });
        res.writeHead(req.url === '/redirect' ? 302 : 200, { location: 'http://169.254.169.254/' });
        res.end('ok');
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it('refuses private targets by IP or by name unless allowed', async () => {
    await expect(postJson(`${url}/hook`, '{}', {}, { allowPrivate: false })).rejects.toBeInstanceOf(
      UnsafeUrlError,
    );
    const port = (server.address() as AddressInfo).port;
    await expect(
      postJson(`http://localhost:${port}/hook`, '{}', {}, { allowPrivate: false }),
    ).rejects.toBeInstanceOf(UnsafeUrlError);
    expect(received).toHaveLength(0);
  });

  it('posts the body and does not follow redirects', async () => {
    const ok = await postJson(
      `${url}/hook`,
      '{"a":1}',
      { 'x-test': 'sig' },
      { allowPrivate: true },
    );
    expect(ok.status).toBe(200);
    expect(received.at(-1)).toEqual({ body: '{"a":1}', signature: 'sig' });
    const redirect = await postJson(`${url}/redirect`, '{}', {}, { allowPrivate: true });
    expect(redirect.status).toBe(302);
  });
});

describe('fetchImage', () => {
  let server: Server;
  let url: string;
  const image = Buffer.from('fake-image-bytes');

  beforeAll(async () => {
    server = createServer((req, res) => {
      const path = req.url ?? '/';
      if (path === '/image.png') {
        res.writeHead(200, { 'content-type': 'image/png' });
        return res.end(image);
      }
      if (path.startsWith('/hop/')) {
        const n = Number(path.slice(5));
        res.writeHead(302, { location: n > 0 ? `/hop/${n - 1}` : '/image.png' });
        return res.end();
      }
      if (path === '/to-metadata') {
        res.writeHead(302, { location: 'http://169.254.169.254/latest/meta-data' });
        return res.end();
      }
      if (path === '/html') {
        res.writeHead(200, { 'content-type': 'text/html' });
        return res.end('<html></html>');
      }
      if (path === '/svg') {
        res.writeHead(200, { 'content-type': 'image/svg+xml' });
        return res.end('<svg/>');
      }
      if (path === '/big') {
        res.writeHead(200, { 'content-type': 'image/jpeg' });
        return res.end(Buffer.alloc(4096));
      }
      if (path === '/slow') {
        res.writeHead(200, { 'content-type': 'image/png' });
        res.write('x');
        return; // never ends
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(() => {
    server.closeAllConnections();
    return new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const local = { allowPrivate: true, allowHttp: true, maxBytes: 1024 };

  it('is https-only and refuses private addresses by default', async () => {
    await expect(fetchImage(`${url}/image.png`, { maxBytes: 1024 })).rejects.toBeInstanceOf(
      UnsafeUrlError,
    );
    const port = (server.address() as AddressInfo).port;
    for (const target of [
      `https://127.0.0.1:${port}/image.png`,
      `https://localhost:${port}/image.png`,
      'https://[::1]/image.png',
      'https://169.254.169.254/latest/meta-data',
    ]) {
      await expect(fetchImage(target, { maxBytes: 1024 }), target).rejects.toBeInstanceOf(
        UnsafeUrlError,
      );
    }
  });

  it('downloads images and follows a few redirects', async () => {
    const result = await fetchImage(`${url}/hop/1`, local);
    expect(result).toEqual({ data: image, contentType: 'image/png' });
    await expect(fetchImage(`${url}/hop/5`, local)).rejects.toThrow(/Too many redirects/);
  });

  it('re-checks every redirect hop', async () => {
    await expect(
      fetchImage(`${url}/to-metadata`, { ...local, allowPrivate: false }),
    ).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it('rejects non-images, oversized bodies, errors and slow servers', async () => {
    await expect(fetchImage(`${url}/html`, local)).rejects.toThrow(/not an image/);
    await expect(fetchImage(`${url}/svg`, local)).rejects.toThrow(/not an image/);
    await expect(fetchImage(`${url}/big`, local)).rejects.toBeInstanceOf(RemoteFetchError);
    await expect(fetchImage(`${url}/missing`, local)).rejects.toThrow(/answered 404/);
    await expect(fetchImage(`${url}/slow`, { ...local, timeoutMs: 300 })).rejects.toThrow(
      /timed out/,
    );
  });
});
