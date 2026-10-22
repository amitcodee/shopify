/**
 * Security headers shared by the Next.js apps. Script execution is limited to Next's own
 * bundles via a per-request nonce + 'strict-dynamic'; inline style *attributes* are allowed
 * (React style props), but not inline scripts.
 */
export function contentSecurityPolicy(options: {
  nonce: string;
  dev: boolean;
  imageOrigins: string[];
  /** Other origins forms may submit to (e.g. the storefront's sign-up form to the admin). */
  formActionOrigins?: string[];
  frameAncestors?: "'none'" | "'self'";
}): string {
  const directives = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${options.nonce}' 'strict-dynamic'${options.dev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: ${options.imageOrigins.join(' ')}`.trim(),
    `font-src 'self' data:`,
    `connect-src 'self'${options.dev ? ' ws: wss:' : ''}`,
    `frame-ancestors ${options.frameAncestors ?? "'none'"}`,
    `form-action 'self' ${(options.formActionOrigins ?? []).join(' ')}`.trim(),
    `base-uri 'self'`,
    `object-src 'none'`,
  ];
  if (!options.dev) directives.push('upgrade-insecure-requests');
  return directives.join('; ');
}

export const STATIC_SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

export const HSTS_HEADER = 'max-age=63072000; includeSubDomains';
