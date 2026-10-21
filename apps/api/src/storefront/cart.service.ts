import { randomBytes } from 'node:crypto';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Cart as CartDto, CreatedCart } from '@repo/contracts';
import type { Prisma, TenantTx } from '@repo/db';
import { hashToken } from '../auth/session.service.js';
import { TenantDb } from '../database/database.module.js';
import { MediaUrls } from '../storage/storage.module.js';
import { isVariantAvailable } from './storefront-catalog.service.js';
import type { ShopContext } from './store-resolver.js';

const CART_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const cartInclude = {
  lines: {
    orderBy: { createdAt: 'asc' },
    include: {
      variant: {
        include: {
          product: {
            select: {
              title: true,
              handle: true,
              status: true,
              images: { orderBy: { position: 'asc' }, take: 1, select: { storageKey: true } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.CartInclude;

type CartWithLines = Prisma.CartGetPayload<{ include: typeof cartInclude }>;
type VariantForStock = {
  trackInventory: boolean;
  allowBackorder: boolean;
  inventoryQuantity: number;
};

function maxOrderable(v: VariantForStock): number | null {
  return v.trackInventory && !v.allowBackorder ? Math.max(0, v.inventoryQuantity) : null;
}

@Injectable()
export class CartService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly media: MediaUrls,
  ) {}

  async create(shop: ShopContext): Promise<CreatedCart> {
    const token = randomBytes(24).toString('base64url');
    const cart = await this.tenantDb.run(shop.id, (tx) =>
      tx.cart.create({
        data: {
          storeId: shop.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + CART_TTL_MS),
        },
        include: cartInclude,
      }),
    );
    return { token, cart: this.toDto(cart, shop) };
  }

  /**
   * New cart holding `lines` as far as they can still be bought: inactive or deleted variants
   * are dropped and quantities are capped at the stock on hand.
   */
  async createWithLines(
    shop: ShopContext,
    lines: { variantId: string; quantity: number }[],
  ): Promise<CreatedCart> {
    const token = randomBytes(24).toString('base64url');
    const cart = await this.tenantDb.run(shop.id, async (tx) => {
      const created = await tx.cart.create({
        data: {
          storeId: shop.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + CART_TTL_MS),
        },
      });
      const variants = await tx.productVariant.findMany({
        where: {
          storeId: shop.id,
          id: { in: lines.map((l) => l.variantId) },
          product: { status: 'ACTIVE' },
        },
      });
      const byId = new Map(variants.map((v) => [v.id, v]));
      const quantities = new Map<string, number>();
      for (const line of lines) {
        const variant = byId.get(line.variantId);
        if (!variant) continue;
        const wanted = (quantities.get(variant.id) ?? 0) + line.quantity;
        const cap = maxOrderable(variant);
        quantities.set(variant.id, Math.min(wanted, cap ?? wanted, 99));
      }
      const data = [...quantities]
        .filter(([, quantity]) => quantity > 0)
        .map(([variantId, quantity]) => ({
          storeId: shop.id,
          cartId: created.id,
          variantId,
          quantity,
        }));
      if (data.length > 0) await tx.cartLine.createMany({ data });
      return tx.cart.findUniqueOrThrow({ where: { id: created.id }, include: cartInclude });
    });
    return { token, cart: this.toDto(cart, shop) };
  }

  get(shop: ShopContext, token: string | null): Promise<CartDto> {
    return this.tenantDb.run(shop.id, async (tx) =>
      this.toDto(await this.load(tx, shop, token), shop),
    );
  }

  addLine(shop: ShopContext, token: string | null, variantId: string, quantity: number) {
    return this.tenantDb.run(shop.id, async (tx) => {
      const cart = await this.load(tx, shop, token);
      const variant = await tx.productVariant.findFirst({
        where: { id: variantId, storeId: shop.id, product: { status: 'ACTIVE' } },
      });
      if (!variant) throw new NotFoundException('This product is not available.');

      const existing = cart.lines.find((l) => l.variantId === variantId);
      const nextQuantity = (existing?.quantity ?? 0) + quantity;
      this.assertStock(variant, nextQuantity);

      if (existing) {
        await tx.cartLine.update({ where: { id: existing.id }, data: { quantity: nextQuantity } });
      } else {
        await tx.cartLine.create({
          data: { storeId: shop.id, cartId: cart.id, variantId, quantity },
        });
      }
      return this.touchAndReload(tx, shop, cart.id);
    });
  }

  updateLine(shop: ShopContext, token: string | null, lineId: string, quantity: number) {
    return this.tenantDb.run(shop.id, async (tx) => {
      const cart = await this.load(tx, shop, token);
      const line = cart.lines.find((l) => l.id === lineId);
      if (!line) throw new NotFoundException('Cart line not found.');
      if (quantity === 0) {
        await tx.cartLine.delete({ where: { id: lineId } });
      } else {
        this.assertStock(line.variant, quantity);
        await tx.cartLine.update({ where: { id: lineId }, data: { quantity } });
      }
      return this.touchAndReload(tx, shop, cart.id);
    });
  }

  removeLine(shop: ShopContext, token: string | null, lineId: string) {
    return this.updateLine(shop, token, lineId, 0);
  }

  /** Loads a live cart by token; another store's or an expired cart is "not found". */
  async load(tx: TenantTx, shop: ShopContext, token: string | null): Promise<CartWithLines> {
    if (!token) throw new NotFoundException('Cart not found.');
    const cart = await tx.cart.findFirst({
      where: { tokenHash: hashToken(token), storeId: shop.id, expiresAt: { gt: new Date() } },
      include: cartInclude,
    });
    if (!cart) throw new NotFoundException('Cart not found.');
    return cart;
  }

  toDto(cart: CartWithLines, shop: ShopContext): CartDto {
    const warnings: string[] = [];
    const lines = cart.lines.map((line) => {
      const { variant } = line;
      const max = maxOrderable(variant);
      const active = variant.product.status === 'ACTIVE';
      const available =
        active && isVariantAvailable(variant) && (max === null || line.quantity <= max);
      if (!active) {
        warnings.push(`${variant.product.title} is no longer available.`);
      } else if (max !== null && line.quantity > max) {
        warnings.push(
          max === 0
            ? `${variant.product.title} (${variant.title}) is out of stock.`
            : `Only ${max} of ${variant.product.title} (${variant.title}) left in stock.`,
        );
      }
      const image = variant.product.images[0];
      return {
        id: line.id,
        variantId: variant.id,
        productTitle: variant.product.title,
        productHandle: variant.product.handle,
        variantTitle: variant.title,
        imageUrl: image ? this.media.url(image.storageKey) : null,
        unitPrice: variant.price,
        quantity: line.quantity,
        lineTotal: variant.price * line.quantity,
        available,
        maxQuantity: max,
      };
    });
    const orderable = lines.filter((l) => l.available);
    return {
      id: cart.id,
      currency: shop.currency,
      lines,
      itemCount: lines.reduce((sum, l) => sum + l.quantity, 0),
      subtotal: orderable.reduce((sum, l) => sum + l.lineTotal, 0),
      warnings,
    };
  }

  private assertStock(variant: VariantForStock, quantity: number): void {
    const max = maxOrderable(variant);
    if (max !== null && quantity > max) {
      throw new ConflictException(
        max === 0 ? 'This item is out of stock.' : `Only ${max} left in stock.`,
      );
    }
  }

  private async touchAndReload(tx: TenantTx, shop: ShopContext, cartId: string): Promise<CartDto> {
    const cart = await tx.cart.update({
      where: { id: cartId },
      data: { expiresAt: new Date(Date.now() + CART_TTL_MS) },
      include: cartInclude,
    });
    return this.toDto(cart, shop);
  }
}
