import { createHmac } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { hashToken } from '../auth/session.service.js';
import { ENV, type Env } from '../config/env.js';

/** Builds links that appear in emails and payment redirects. */
@Injectable()
export class StoreUrls {
  constructor(@Inject(ENV) private readonly env: Env) {}

  storefrontOrigin(subdomain: string, primaryDomain?: string | null): string {
    if (primaryDomain) return `${this.env.STOREFRONT_PROTOCOL}://${primaryDomain}`;
    return this.env.STOREFRONT_PUBLIC_URL.replace('{subdomain}', subdomain).replace(/\/$/, '');
  }

  /** Origin of the host the shopper is actually on (signed by the storefront server). */
  originForHost(host: string): string {
    return `${this.env.STOREFRONT_PROTOCOL}://${host}`;
  }

  adminOrderUrl(storeId: string, orderId: string): string {
    return `${this.env.ADMIN_PUBLIC_URL}/s/${storeId}/orders/${orderId}`;
  }

  /**
   * Order-status link token: `<orderId>.<HMAC>`. Deterministic, so emails sent later (after the
   * payment webhook) can rebuild the same link; only its SHA-256 is stored for lookup.
   */
  orderAccessToken(orderId: string): string {
    const mac = createHmac('sha256', this.env.STOREFRONT_SHARED_SECRET)
      .update(`order-link:${orderId}`)
      .digest('base64url');
    return `${orderId}.${mac}`;
  }

  orderAccessTokenHash(orderId: string): string {
    return hashToken(this.orderAccessToken(orderId));
  }
}
