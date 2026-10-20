import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret, signToken, verifyToken } from '../common/crypto.js';
import { base32Decode, base32Encode, currentStep, totpCode, verifyTotp } from './totp.js';

describe('TOTP (RFC 6238)', () => {
  // RFC 6238 Appendix B test secret "12345678901234567890" (SHA-1).
  const secret = base32Encode(Buffer.from('12345678901234567890'));

  it('matches the RFC test vectors', () => {
    // T = 59 s -> step 1 -> 94287082 (8 digits); 6-digit truncation -> 287082
    expect(totpCode(secret, 1)).toBe('287082');
    // T = 1111111109 -> 07081804 -> 081804
    expect(totpCode(secret, Math.floor(1111111109 / 30))).toBe('081804');
  });

  it('round-trips base32 and accepts codes within one step only', () => {
    expect(base32Decode(secret).toString()).toBe('12345678901234567890');
    const now = Date.now();
    const step = currentStep(now);
    expect(verifyTotp(secret, totpCode(secret, step), now)).toBe(step);
    expect(verifyTotp(secret, totpCode(secret, step - 1), now)).toBe(step - 1);
    expect(verifyTotp(secret, totpCode(secret, step - 3), now)).toBeNull();
    expect(verifyTotp(secret, 'abc123', now)).toBeNull();
  });
});

describe('crypto helpers', () => {
  const key = 'x'.repeat(40);

  it('encrypts with authentication (tampering is detected)', () => {
    const sealed = encryptSecret(key, 'JBSWY3DPEHPK3PXP');
    expect(sealed).not.toContain('JBSWY3DPEHPK3PXP');
    expect(decryptSecret(key, sealed)).toBe('JBSWY3DPEHPK3PXP');
    const [iv, tag, data] = sealed.split('.');
    const tampered = [iv, tag, `${data?.slice(0, -2)}AA`].join('.');
    expect(() => decryptSecret(key, tampered)).toThrow();
    expect(() => decryptSecret('y'.repeat(40), sealed)).toThrow();
  });

  it('signs purpose-bound, expiring tokens', () => {
    const token = signToken(key, 'mfa', { uid: 'u1' }, 60_000);
    expect(verifyToken(key, 'mfa', token)).toMatchObject({ uid: 'u1' });
    expect(verifyToken(key, 'other', token)).toBeNull();
    expect(verifyToken('z'.repeat(40), 'mfa', token)).toBeNull();
    expect(verifyToken(key, 'mfa', signToken(key, 'mfa', { uid: 'u1' }, -1))).toBeNull();
  });
});
