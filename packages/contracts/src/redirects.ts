const BASE = 'https://same-origin.invalid';

/**
 * Returns `value` only if it is a same-origin relative path (for post-login redirects), else
 * `fallback`. It is resolved like a browser would, so `//evil`, `/\evil`, encoded or
 * whitespace/control-character tricks cannot escape to another origin.
 */
export function safeRelativePath(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || value.length > 2048) return fallback;
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  // Backslashes and control characters (incl. tab/newline, which browsers strip) are refused.
  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
  let url: URL;
  try {
    url = new URL(value, BASE);
  } catch {
    return fallback;
  }
  if (url.origin !== BASE) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}
