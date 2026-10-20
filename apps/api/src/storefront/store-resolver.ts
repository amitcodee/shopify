import { Inject, Injectable } from '@nestjs/common';
import { parseTheme, type Theme } from '@repo/contracts';
import type { PrismaClient } from '@repo/db';
import { ENV, type Env } from '../config/env.js';
import { APP_DB } from '../database/database.module.js';

export interface ShopContext {
  id: string;
  name: string;
  subdomain: string;
  currency: string;
  contactEmail: string;
  theme: Theme;
}

const CACHE_TTL_MS = 30_000;

/** Normalizes a Host header value: lowercase, no port, no trailing dot. */
export function normalizeHost(host: string): string {
  const lower = host.trim().toLowerCase();
  const withoutPort = lower.startsWith('[') ? lower : lower.replace(/:\d+$/, '');
  return withoutPort.replace(/\.$/, '');
}

/**
 * Maps a storefront hostname to an ACTIVE store: `<subdomain>.<root domain>` or (Phase 6) a
 * verified custom domain. Results are cached briefly; suspensions take effect within 30s.
 */
@Injectable()
export class StoreResolver {
  private readonly root: string;
  private readonly cache = new Map<string, { value: ShopContext | null; expires: number }>();

  constructor(
    @Inject(APP_DB) private readonly db: PrismaClient,
    @Inject(ENV) env: Env,
  ) {
    this.root = normalizeHost(env.STOREFRONT_ROOT_DOMAIN);
  }

  async resolve(rawHost: string): Promise<ShopContext | null> {
    const host = normalizeHost(rawHost);
    const cached = this.cache.get(host);
    if (cached && cached.expires > Date.now()) return cached.value;

    const value = await this.lookup(host);
    this.cache.set(host, { value, expires: Date.now() + CACHE_TTL_MS });
    if (this.cache.size > 5000) this.cache.delete(this.cache.keys().next().value as string);
    return value;
  }

  invalidate(): void {
    this.cache.clear();
  }

  private async lookup(host: string): Promise<ShopContext | null> {
    const suffix = `.${this.root}`;
    if (!host.endsWith(suffix)) return this.lookupCustomDomain(host);

    const subdomain = host.slice(0, -suffix.length);
    // Deeper names under the root (e.g. www.brand.localhost in development) can be custom domains.
    if (!subdomain) return null;
    if (subdomain.includes('.')) return this.lookupCustomDomain(host);
    const store = await this.db.store.findUnique({ where: { subdomain } });
    return store && store.status === 'ACTIVE' ? this.toContext(store) : null;
  }

  /** Verified custom domains (Phase 6). */
  protected async lookupCustomDomain(host: string): Promise<ShopContext | null> {
    // Several stores may have claimed a hostname; only the (single) verified claim routes.
    const domain = await this.db.domain.findFirst({
      where: { hostname: host, verifiedAt: { not: null } },
      include: { store: true },
    });
    if (!domain || domain.store.status !== 'ACTIVE') return null;
    return this.toContext(domain.store);
  }

  protected toContext(store: {
    id: string;
    name: string;
    subdomain: string;
    currency: string;
    contactEmail: string;
    themePreset: string;
    themeSettings: unknown;
  }): ShopContext {
    return {
      id: store.id,
      name: store.name,
      subdomain: store.subdomain,
      currency: store.currency,
      contactEmail: store.contactEmail,
      theme: parseTheme(store.themePreset, store.themeSettings),
    };
  }
}
