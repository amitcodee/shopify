import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import { BlockList, isIP } from 'node:net';

/** Addresses a merchant-supplied URL must never reach: loopback, private, link-local, metadata. */
const BLOCKED = new BlockList();
for (const [net, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 3],
] as const) {
  BLOCKED.addSubnet(net, prefix, 'ipv4');
}
for (const [net, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
  ['64:ff9b::', 96],
  ['2001:db8::', 32],
] as const) {
  BLOCKED.addSubnet(net, prefix, 'ipv6');
}

export function isBlockedAddress(address: string): boolean {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1];
  if (mapped) return BLOCKED.check(mapped, 'ipv4');
  const family = isIP(address);
  if (family === 0) return true;
  return BLOCKED.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

export class UnsafeUrlError extends Error {}

type LookupCallback = (
  error: Error | null,
  address: string | LookupAddress[],
  family?: number,
) => void;

/**
 * A `lookup` for http(s).request that resolves the host once and, unless `allowPrivate`, fails
 * when any resolved address is private. The connection then uses that vetted address (no second
 * lookup, so DNS rebinding cannot swap in an internal IP).
 */
function vettedLookup(allowPrivate: boolean) {
  return (hostname: string, lookupOptions: object, callback: LookupCallback) => {
    dnsLookup(hostname, { all: true }, (error, addresses) => {
      if (error) return callback(error, '');
      if (!allowPrivate && addresses.some((a) => isBlockedAddress(a.address))) {
        return callback(new UnsafeUrlError(`${hostname} resolves to a private address`), '');
      }
      const first = addresses[0];
      if (!first) return callback(new Error(`${hostname} did not resolve`), '');
      if ((lookupOptions as { all?: boolean }).all) return callback(null, [first]);
      callback(null, first.address, first.family);
    });
  };
}

/** The error for an IP-literal host in a blocked range (Node does not call `lookup` for those). */
function blockedLiteral(target: URL, allowPrivate: boolean): UnsafeUrlError | null {
  const literal = target.hostname.replace(/^\[|\]$/g, '');
  return !allowPrivate && isIP(literal) !== 0 && isBlockedAddress(literal)
    ? new UnsafeUrlError(`${literal} is a private address`)
    : null;
}

/**
 * POSTs a body without following redirects. Unless `allowPrivate`, the host is resolved and
 * every resolved address must be public; the connection then uses that vetted address (no
 * second lookup, so DNS rebinding cannot swap in an internal IP).
 */
export function postJson(
  url: string,
  body: string,
  headers: Record<string, string>,
  options: { allowPrivate: boolean; timeoutMs?: number },
): Promise<{ status: number }> {
  const target = new URL(url);
  const client = target.protocol === 'https:' ? https : target.protocol === 'http:' ? http : null;
  if (!client) return Promise.reject(new UnsafeUrlError('Only http(s) URLs are allowed'));
  const blocked = blockedLiteral(target, options.allowPrivate);
  if (blocked) return Promise.reject(blocked);

  const lookup = vettedLookup(options.allowPrivate);

  return new Promise((resolve, reject) => {
    const request = client.request(
      target,
      {
        method: 'POST',
        headers: {
          ...headers,
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
        },
        lookup,
        agent: false,
        timeout: options.timeoutMs ?? 5000,
      },
      (response) => {
        // The receiver's answer is not needed; drain it without buffering.
        response.resume();
        response.on('end', () => resolve({ status: response.statusCode ?? 0 }));
        response.on('error', reject);
      },
    );
    request.on('timeout', () => request.destroy(new Error('Timed out')));
    request.on('error', reject);
    request.end(body);
  });
}

/** A download that failed for a reason worth showing to the merchant. */
export class RemoteFetchError extends Error {}

export interface FetchImageOptions {
  /** Tests only: reach loopback/private hosts. */
  allowPrivate?: boolean;
  /** Tests only: allow plain http (production requires https). */
  allowHttp?: boolean;
  maxBytes: number;
  /** Whole download, redirects included. */
  timeoutMs?: number;
  maxRedirects?: number;
}

/**
 * Downloads an image from a merchant-supplied URL. Every hop (at most `maxRedirects`
 * redirects) is https-only and must resolve to public addresses; the response must declare an
 * image content type and stay under `maxBytes`. The bytes are still untrusted: callers decode
 * and re-encode them.
 */
export async function fetchImage(
  url: string,
  options: FetchImageOptions,
): Promise<{ data: Buffer; contentType: string }> {
  const deadline = Date.now() + (options.timeoutMs ?? 15_000);
  let target = new URL(url);
  for (let hop = 0; ; hop++) {
    const allowed =
      target.protocol === 'https:' || (options.allowHttp && target.protocol === 'http:');
    if (!allowed) throw new UnsafeUrlError('Only https:// URLs can be imported');
    if (target.username || target.password)
      throw new UnsafeUrlError('URLs cannot contain credentials');
    const blocked = blockedLiteral(target, options.allowPrivate ?? false);
    if (blocked) throw blocked;

    const result = await getOnce(target, options, deadline);
    if ('redirect' in result) {
      if (hop >= (options.maxRedirects ?? 3)) throw new RemoteFetchError('Too many redirects');
      target = new URL(result.redirect, target);
      continue;
    }
    return result;
  }
}

function getOnce(
  target: URL,
  options: FetchImageOptions,
  deadline: number,
): Promise<{ data: Buffer; contentType: string } | { redirect: string }> {
  const client = target.protocol === 'https:' ? https : http;
  const remaining = deadline - Date.now();
  if (remaining <= 0) return Promise.reject(new RemoteFetchError('The download timed out'));

  return new Promise((resolve, reject) => {
    const request = client.request(
      target,
      {
        method: 'GET',
        headers: { accept: 'image/*', 'user-agent': 'ShopImageImporter/1.0' },
        lookup: vettedLookup(options.allowPrivate ?? false),
        agent: false,
        timeout: remaining,
      },
      (response) => {
        const status = response.statusCode ?? 0;
        const location = response.headers.location;
        if ([301, 302, 303, 307, 308].includes(status) && location) {
          response.resume();
          return resolve({ redirect: location });
        }
        const fail = (message: string) => {
          response.destroy();
          reject(new RemoteFetchError(message));
        };
        if (status !== 200) return fail(`The server answered ${status}`);
        const contentType = (response.headers['content-type'] ?? '').split(';')[0]?.trim() ?? '';
        if (!/^image\/[a-z0-9.+-]+$/i.test(contentType) || /svg/i.test(contentType)) {
          return fail('The URL is not an image');
        }
        const tooLarge = `The image is larger than ${Math.floor(options.maxBytes / 1_048_576)} MB`;
        const declared = Number(response.headers['content-length'] ?? 0);
        if (declared > options.maxBytes) return fail(tooLarge);

        const chunks: Buffer[] = [];
        let size = 0;
        response.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > options.maxBytes) return fail(tooLarge);
          chunks.push(chunk);
        });
        response.on('end', () => resolve({ data: Buffer.concat(chunks), contentType }));
        response.on('error', reject);
      },
    );
    const timer = setTimeout(
      () => request.destroy(new RemoteFetchError('The download timed out')),
      remaining,
    );
    request.on('close', () => clearTimeout(timer));
    request.on('timeout', () => request.destroy(new RemoteFetchError('The download timed out')));
    request.on('error', reject);
    request.end();
  });
}
