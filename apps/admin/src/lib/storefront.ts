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

/** Help guides on the marketing site, by slug (see the storefront's guides-data.ts). */
export type GuideSlug =
  | 'create-your-store'
  | 'add-products'
  | 'set-up-payments'
  | 'shipping-and-taxes'
  | 'apply-a-template'
  | 'connect-a-domain'
  | 'run-a-discount'
  | 'fulfil-and-refund'
  | 'multi-currency'
  | 'invite-staff'
  | 'api-and-webhooks';

/** "How it works" link for a page header or empty state. */
export function guide(slug: GuideSlug, label?: string): { href: string; label?: string } {
  return { href: marketingUrl(`/guides/${slug}`), ...(label ? { label } : {}) };
}
