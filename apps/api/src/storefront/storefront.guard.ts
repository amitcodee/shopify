import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { STOREFRONT_HEADERS, storefrontSignaturePayload } from '@repo/contracts';
import type { Request } from 'express';
import { ENV, type Env } from '../config/env.js';
import { type ShopContext, StoreResolver } from './store-resolver.js';

const MAX_SKEW_MS = 5 * 60 * 1000;

export interface StorefrontRequest extends Request {
  shop?: ShopContext;
}

export function signStorefrontRequest(secret: string, host: string, timestamp: string): string {
  return createHmac('sha256', secret)
    .update(storefrontSignaturePayload(host, timestamp))
    .digest('hex');
}

function header(req: Request, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Storefront requests come from our storefront server, which forwards the shopper's Host
 * header signed with a shared secret. The API resolves the store from that host only —
 * never from a client-supplied store id.
 */
@Injectable()
export class StorefrontGuard implements CanActivate {
  private readonly secret: string;

  constructor(
    @Inject(ENV) env: Env,
    private readonly resolver: StoreResolver,
  ) {
    this.secret = env.STOREFRONT_SHARED_SECRET;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<StorefrontRequest>();
    const host = header(req, STOREFRONT_HEADERS.host);
    const timestamp = header(req, STOREFRONT_HEADERS.timestamp);
    const signature = header(req, STOREFRONT_HEADERS.signature);
    if (!host || !timestamp || !signature) {
      throw new UnauthorizedException('Unsigned storefront request.');
    }

    const age = Math.abs(Date.now() - Number(timestamp));
    if (!Number.isFinite(age) || age > MAX_SKEW_MS) {
      throw new UnauthorizedException('Storefront signature expired.');
    }
    const expected = Buffer.from(signStorefrontRequest(this.secret, host, timestamp), 'hex');
    const given = Buffer.from(signature, 'hex');
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      throw new UnauthorizedException('Invalid storefront signature.');
    }

    const shop = await this.resolver.resolve(host);
    if (!shop) throw new NotFoundException('Store not found.');
    req.shop = shop;
    return true;
  }
}

export const CurrentShop = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): ShopContext => {
    const req = ctx.switchToHttp().getRequest<StorefrontRequest>();
    if (!req.shop) throw new Error('CurrentShop used without StorefrontGuard');
    return req.shop;
  },
);

/** Optional cart token from the storefront server (the shopper's HttpOnly cookie). */
export const CartToken = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string | null => {
    const value = header(ctx.switchToHttp().getRequest<Request>(), STOREFRONT_HEADERS.cart);
    return value && value.length <= 200 ? value : null;
  },
);
