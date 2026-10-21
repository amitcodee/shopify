import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isBlockedAddress, postJson, UnsafeUrlError } from './safe-http.js';

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
