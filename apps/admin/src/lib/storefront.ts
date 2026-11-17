const storefrontOrigin = process.env.STOREFRONT_PUBLIC_URL ?? 'http://{subdomain}.localhost:3200';

/** Public storefront origin for a store's subdomain (server-only: reads the environment). */
export function storefrontUrlFor(subdomain: string): string {
  return storefrontOrigin.replace('{subdomain}', subdomain);
}

/**
 * The platform's marketing site (the storefront app on the root domain), derived from the store
 * URL pattern: `https://{subdomain}.example.com` -> `https://example.com`.
 */
export function marketingUrl(path = ''): string {
  return `${storefrontOrigin.replace('{subdomain}.', '')}${path}`;
}
