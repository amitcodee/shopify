import { createHmac, timingSafeEqual } from 'node:crypto';
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

  /** Abandoned-checkout link token: `<orderId>.<HMAC>` (a different purpose than order links). */
  checkoutRecoveryToken(orderId: string): string {
    const mac = createHmac('sha256', this.env.STOREFRONT_SHARED_SECRET)
      .update(`checkout-recovery:${orderId}`)
      .digest('base64url');
    return `${orderId}.${mac}`;
  }

  /** The order id a recovery token was issued for, or null when it is not authentic. */
  verifyCheckoutRecoveryToken(token: string): string | null {
    const orderId = token.split('.', 1)[0] ?? '';
    if (!/^[0-9a-f-]{36}$/.test(orderId)) return null;
    const expected = Buffer.from(this.checkoutRecoveryToken(orderId));
    const given = Buffer.from(token);
    return given.length === expected.length && timingSafeEqual(given, expected) ? orderId : null;
  }
}
