import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

/** Derives a 32-byte key from the configured secret (any length ≥ 32 characters). */
function key(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

/** AES-256-GCM encryption for secrets at rest (e.g. TOTP seeds). Output: iv.tag.ciphertext (base64url). */
export function encryptSecret(secret: string, plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(secret), iv);
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64url')).join('.');
}

export function decryptSecret(secret: string, payload: string): string {
  const [iv, tag, data] = payload.split('.').map((p) => Buffer.from(p, 'base64url'));
  if (!iv || !tag || !data) throw new Error('Malformed encrypted value');
  const decipher = createDecipheriv('aes-256-gcm', key(secret), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

/** Short-lived signed token: base64url(JSON payload).HMAC. Rejects tampering and expiry. */
export function signToken(
  secret: string,
  purpose: string,
  payload: Record<string, unknown>,
  ttlMs: number,
): string {
  const body = Buffer.from(
    JSON.stringify({ ...payload, p: purpose, exp: Date.now() + ttlMs }),
  ).toString('base64url');
  const mac = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${mac}`;
}

export function verifyToken<T extends Record<string, unknown>>(
  secret: string,
  purpose: string,
  token: string,
): T | null {
  const [body, mac] = token.split('.');
  if (!body || !mac) return null;
  const expected = createHmac('sha256', secret).update(body).digest();
  const given = Buffer.from(mac, 'base64url');
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T & {
      p: string;
      exp: number;
    };
    return payload.p === purpose && payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}
