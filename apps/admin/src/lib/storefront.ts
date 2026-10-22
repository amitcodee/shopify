const storefrontOrigin = process.env.STOREFRONT_PUBLIC_URL ?? 'http://{subdomain}.localhost:3200';

/** Public storefront origin for a store's subdomain (server-only: reads the environment). */
export function storefrontUrlFor(subdomain: string): string {
  return storefrontOrigin.replace('{subdomain}', subdomain);
}
