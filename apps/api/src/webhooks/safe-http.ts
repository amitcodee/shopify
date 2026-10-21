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
  // Node does not call `lookup` for IP literals, so check those here.
  const literal = target.hostname.replace(/^\[|\]$/g, '');
  if (!options.allowPrivate && isIP(literal) !== 0 && isBlockedAddress(literal)) {
    return Promise.reject(new UnsafeUrlError(`${literal} is a private address`));
  }

  const lookup = (
    hostname: string,
    lookupOptions: object,
    callback: (error: Error | null, address: string | LookupAddress[], family?: number) => void,
  ) => {
    dnsLookup(hostname, { all: true }, (error, addresses) => {
      if (error) return callback(error, '');
      if (!options.allowPrivate && addresses.some((a) => isBlockedAddress(a.address))) {
        return callback(new UnsafeUrlError(`${hostname} resolves to a private address`), '');
      }
      const first = addresses[0];
      if (!first) return callback(new Error(`${hostname} did not resolve`), '');
      if ((lookupOptions as { all?: boolean }).all) return callback(null, [first]);
      callback(null, first.address, first.family);
    });
  };

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
