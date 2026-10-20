import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  Cart,
  CheckoutPreview,
  CheckoutPreviewInput,
  CheckoutResult,
  checkoutInputSchema,
  MockPayment,
  PublicOrder,
  ShippingOption,
} from '@repo/contracts';
import type { Prisma, TenantTx } from '@repo/db';
import type { z } from 'zod';
import {
  type DiscountEvaluation,
  DiscountRules,
  ShippingRules,
  TaxRules,
} from '../commerce/commerce-rules.js';
import { ENV, type Env } from '../config/env.js';
import { TenantDb } from '../database/database.module.js';
import { OrderLifecycle } from '../orders/order-lifecycle.service.js';
import { PlanLimits } from '../platform/plans.service.js';
import { StoreUrls } from '../orders/store-urls.js';
import { applicationFee } from '../payments/connect-provider.js';
import { PaymentAccountsService } from '../payments/payment-accounts.service.js';
import { ACTIVE_PAYMENT_PROVIDER, type PaymentProvider } from '../payments/payment-provider.js';
import { CartService } from '../storefront/cart.service.js';
import type { ShopContext } from '../storefront/store-resolver.js';
import { hashToken } from '../auth/session.service.js';
import { priceCart, type PricingResult } from './pricing.js';

type CheckoutInput = z.output<typeof checkoutInputSchema>;

interface Quote {
  cart: Cart;
  pricing: PricingResult;
  requiresShipping: boolean;
  shippingOptions: ShippingOption[];
  selectedShipping: ShippingOption | null;
  discount: DiscountEvaluation | null;
  lines: {
    variantId: string;
    productId: string;
    title: string;
    variantTitle: string;
    sku: string | null;
    unitPrice: number;
    quantity: number;
    taxable: boolean;
    requiresShipping: boolean;
    weightGrams: number;
    trackInventory: boolean;
  }[];
}

const MAX_PENDING_ORDERS_PER_EMAIL = 3;

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly tenantDb: TenantDb,
    private readonly carts: CartService,
    private readonly shipping: ShippingRules,
    private readonly tax: TaxRules,
    private readonly discounts: DiscountRules,
    private readonly lifecycle: OrderLifecycle,
    private readonly urls: StoreUrls,
    private readonly limits: PlanLimits,
    private readonly paymentAccounts: PaymentAccountsService,
    @Inject(ACTIVE_PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    @Inject(ENV) private readonly env: Env,
  ) {}

  preview(
    shop: ShopContext,
    cartToken: string | null,
    input: CheckoutPreviewInput,
  ): Promise<CheckoutPreview> {
    return this.tenantDb.run(shop.id, async (tx) => {
      const cart = this.carts.toDto(await this.carts.load(tx, shop, cartToken), shop);
      const quote = await this.quote(tx, shop, cart, input);
      return {
        currency: shop.currency,
        subtotal: quote.pricing.subtotal,
        discountTotal: quote.pricing.discountTotal,
        shippingTotal: quote.pricing.shippingTotal,
        taxTotal: quote.pricing.taxTotal,
        total: quote.pricing.total,
        lines: cart.lines,
        requiresShipping: quote.requiresShipping,
        shippingOptions: quote.shippingOptions,
        selectedShippingRateId: quote.selectedShipping?.id ?? null,
        discount: quote.discount
          ? {
              code: quote.discount.code,
              applied: quote.discount.applied,
              message: quote.discount.message,
            }
          : null,
        warnings: cart.warnings,
        acceptingPayments: await this.paymentAccounts.acceptingPayments(tx, shop.id),
      };
    });
  }

  /**
   * Places an order: validates the cart, prices it server-side, reserves stock atomically and
   * creates the order in one transaction; then opens a payment session with the provider.
   */
  async place(
    shop: ShopContext,
    host: string,
    cartToken: string | null,
    customerId: string | null,
    input: CheckoutInput,
  ): Promise<CheckoutResult> {
    const existing = await this.tenantDb.run(shop.id, async (tx) => {
      const order = await tx.order.findFirst({
        where: { storeId: shop.id, checkoutKey: input.idempotencyKey },
        include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
      });
      if (!order) return null;
      // A replayed key only resumes the order for the cart that placed it; anyone else learning
      // the key must not get the order's payment or status link.
      const ownsCart =
        cartToken !== null &&
        order.cartId !== null &&
        (await tx.cart.count({
          where: { id: order.cartId, storeId: shop.id, tokenHash: hashToken(cartToken) },
        })) > 0;
      if (!ownsCart) throw new ConflictException('This checkout has already been submitted.');
      return order;
    });
    if (existing) return this.resume(shop, host, existing);

    const order = await this.tenantDb.run(shop.id, async (tx) => {
      await this.limits.assertCanAcceptOrder(tx, shop.id);
      const initialCart = await this.carts.load(tx, shop, cartToken);

      // A shopper who restarts checkout must not be blocked by (or hold) their own earlier
      // reservation: release superseded pending orders first, then re-read the cart.
      const superseded = await tx.order.findMany({
        where: { storeId: shop.id, cartId: initialCart.id, status: 'PENDING_PAYMENT' },
        select: { id: true },
      });
      for (const old of superseded) {
        await this.lifecycle.cancelInTx(tx, shop.id, old.id, {
          reason: 'superseded',
          restock: true,
          actorUserId: null,
        });
      }
      const cartRow =
        superseded.length > 0 ? await this.carts.load(tx, shop, cartToken) : initialCart;
      const cart = this.carts.toDto(cartRow, shop);
      if (cart.lines.length === 0) throw new BadRequestException('Your cart is empty.');
      if (cart.lines.some((l) => !l.available)) {
        throw new ConflictException(
          'Some items in your cart are no longer available. Please review your cart.',
        );
      }

      const quote = await this.quote(tx, shop, cart, {
        country: input.shippingAddress.country,
        region: input.shippingAddress.region,
        shippingRateId: input.shippingRateId,
        discountCode: input.discountCode,
      });
      if (quote.requiresShipping && !quote.selectedShipping) {
        throw new BadRequestException('We do not ship to this address.');
      }
      if (input.discountCode && !quote.discount?.applied) {
        throw new BadRequestException(
          quote.discount?.message ?? 'This discount code is not valid.',
        );
      }
      // Paid orders need somewhere to settle: no stock is reserved for a store that cannot
      // take payments yet.
      if (quote.pricing.total > 0) await this.paymentAccounts.requireDestination(tx, shop.id);

      const customer = customerId
        ? await tx.customer.findFirstOrThrow({ where: { id: customerId, storeId: shop.id } })
        : await tx.customer.upsert({
            where: { storeId_email: { storeId: shop.id, email: input.email } },
            update: {},
            create: { storeId: shop.id, email: input.email, name: input.shippingAddress.name },
          });

      const email = customerId ? customer.email : input.email;
      const pending = await tx.order.count({
        where: {
          storeId: shop.id,
          email,
          status: 'PENDING_PAYMENT',
          expiresAt: { gt: new Date() },
        },
      });
      if (pending >= MAX_PENDING_ORDERS_PER_EMAIL) {
        // Caps how much stock one address can hold hostage with unpaid checkouts.
        throw new HttpException(
          'You have unpaid orders waiting. Complete or wait for them to expire before placing another.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      const [counter] = await tx.$queryRaw<{ number: number }[]>`
        INSERT INTO "OrderCounter" ("storeId", "next") VALUES (${shop.id}::uuid, 1002)
        ON CONFLICT ("storeId") DO UPDATE SET "next" = "OrderCounter"."next" + 1
        RETURNING "next" - 1 AS number`;
      if (!counter) throw new Error('Could not allocate an order number');

      const created = await tx.order.create({
        data: {
          storeId: shop.id,
          number: counter.number,
          customerId: customer.id,
          email,
          currency: shop.currency,
          subtotal: quote.pricing.subtotal,
          discountTotal: quote.pricing.discountTotal,
          shippingTotal: quote.pricing.shippingTotal,
          taxTotal: quote.pricing.taxTotal,
          total: quote.pricing.total,
          discountCode: quote.discount?.applied ? quote.discount.code : null,
          shippingMethod: quote.selectedShipping?.name ?? null,
          shippingAddress: input.shippingAddress,
          accessTokenHash: hashToken(`pending:${input.idempotencyKey}`),
          checkoutKey: input.idempotencyKey,
          cartId: cartRow.id,
          paymentProvider: this.provider.name,
          note: input.note ?? null,
          expiresAt: new Date(Date.now() + this.env.ORDER_PAYMENT_TIMEOUT_MINUTES * 60_000),
          lines: {
            create: quote.lines.map((l, i) => ({
              productId: l.productId,
              variantId: l.variantId,
              title: l.title,
              variantTitle: l.variantTitle,
              sku: l.sku,
              unitPrice: l.unitPrice,
              quantity: l.quantity,
              discountTotal: quote.pricing.lineDiscounts[i] ?? 0,
              taxable: l.taxable,
              requiresShipping: l.requiresShipping,
              weightGrams: l.weightGrams,
              stockReserved: l.trackInventory,
            })),
          },
        },
        include: { lines: true },
      });
      // The real lookup hash is derived from the order id (see StoreUrls.orderAccessToken).
      await tx.order.update({
        where: { id: created.id },
        data: { accessTokenHash: this.urls.orderAccessTokenHash(created.id) },
      });

      await this.reserveStock(tx, shop.id, created.id, quote);
      await this.lifecycle.event(
        tx,
        shop.id,
        created.id,
        'placed',
        `Order placed by ${created.email}.`,
      );

      if (created.total === 0) await this.lifecycle.markFreeOrderPaid(tx, shop.id, created);
      return created;
    });

    if (order.total === 0) {
      return { orderNumber: order.number, paymentUrl: this.statusUrl(host, order.id) };
    }
    return this.openPayment(shop, host, order);
  }

  async getMockPayment(shop: ShopContext, reference: string): Promise<MockPayment> {
    const payment = await this.findMockPayment(shop, reference);
    return {
      reference,
      storeName: shop.name,
      orderNumber: payment.order.number,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      returnUrl: payment.returnUrl,
    };
  }

  async publicOrder(shop: ShopContext, token: string): Promise<PublicOrder> {
    const order = await this.tenantDb.run(shop.id, (tx) =>
      tx.order.findFirst({
        where: { storeId: shop.id, accessTokenHash: hashToken(token) },
        include: { lines: true, fulfillments: { orderBy: { createdAt: 'asc' } } },
      }),
    );
    if (!order) throw new NotFoundException('Order not found.');
    return toPublicOrder(shop.name, order);
  }

  async findMockPayment(shop: ShopContext, reference: string) {
    if (this.provider.name !== 'mock') throw new NotFoundException();
    const payment = await this.tenantDb.run(shop.id, (tx) =>
      tx.payment.findFirst({
        where: { storeId: shop.id, provider: 'mock', providerRef: reference },
        include: { order: { select: { number: true } } },
      }),
    );
    if (!payment) throw new NotFoundException('Payment not found.');
    return payment;
  }

  private async quote(
    tx: TenantTx,
    shop: ShopContext,
    cart: Cart,
    input: CheckoutPreviewInput,
  ): Promise<Quote> {
    const available = cart.lines.filter((l) => l.available);
    const variants = await tx.productVariant.findMany({
      where: { storeId: shop.id, id: { in: available.map((l) => l.variantId) } },
    });
    const byId = new Map(variants.map((v) => [v.id, v]));
    const lines = available.flatMap((l) => {
      const v = byId.get(l.variantId);
      return v
        ? [
            {
              variantId: v.id,
              productId: v.productId,
              title: l.productTitle,
              variantTitle: l.variantTitle,
              sku: v.sku,
              unitPrice: v.price,
              quantity: l.quantity,
              taxable: v.taxable,
              requiresShipping: v.requiresShipping,
              weightGrams: v.weightGrams,
              trackInventory: v.trackInventory,
            },
          ]
        : [];
    });

    const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
    const requiresShipping = lines.some((l) => l.requiresShipping);
    const destination = { country: input.country, region: input.region };
    const shippingOptions = await this.shipping.optionsFor(tx, shop.id, destination, {
      subtotal,
      weightGrams: lines.reduce(
        (s, l) => s + (l.requiresShipping ? l.weightGrams * l.quantity : 0),
        0,
      ),
      requiresShipping,
    });
    const selectedShipping =
      shippingOptions.find((o) => o.id === input.shippingRateId) ?? shippingOptions[0] ?? null;
    const discount = input.discountCode
      ? await this.discounts.evaluate(tx, shop.id, input.discountCode, subtotal)
      : null;
    const tax = input.country
      ? await this.tax.rateFor(tx, shop.id, destination)
      : { rateBps: 0, taxShipping: false };

    const pricing = priceCart({
      lines,
      discount: discount?.applied ? discount.rule : null,
      shippingPrice: selectedShipping?.price ?? 0,
      taxRateBps: tax.rateBps,
      taxShipping: tax.taxShipping,
    });
    return { cart, pricing, requiresShipping, shippingOptions, selectedShipping, discount, lines };
  }

  /** Atomic conditional decrements: concurrent checkouts can never oversell. */
  private async reserveStock(
    tx: TenantTx,
    storeId: string,
    orderId: string,
    quote: Quote,
  ): Promise<void> {
    for (const line of quote.lines) {
      if (!line.trackInventory) continue;
      const rows = await tx.$queryRaw<{ inventoryQuantity: number }[]>`
        UPDATE "ProductVariant"
        SET "inventoryQuantity" = "inventoryQuantity" - ${line.quantity}, "updatedAt" = now()
        WHERE id = ${line.variantId}::uuid AND "storeId" = ${storeId}::uuid
          AND ("inventoryQuantity" >= ${line.quantity} OR "allowBackorder")
        RETURNING "inventoryQuantity"`;
      const row = rows[0];
      if (!row)
        throw new ConflictException(`${line.title} just sold out. Please review your cart.`);
      await tx.inventoryAdjustment.create({
        data: {
          storeId,
          variantId: line.variantId,
          delta: -line.quantity,
          quantityAfter: row.inventoryQuantity,
          reason: 'ORDER',
          referenceId: orderId,
        },
      });
    }
  }

  private async resume(
    shop: ShopContext,
    host: string,
    order: Prisma.OrderGetPayload<{ include: { payments: true } }>,
  ): Promise<CheckoutResult> {
    const payment = order.payments[0];
    if (order.status !== 'PENDING_PAYMENT') {
      return { orderNumber: order.number, paymentUrl: this.statusUrl(host, order.id) };
    }
    if (payment?.status === 'PENDING' && payment.checkoutUrl) {
      return { orderNumber: order.number, paymentUrl: payment.checkoutUrl };
    }
    return this.openPayment(shop, host, order);
  }

  private async openPayment(
    shop: ShopContext,
    host: string,
    order: { id: string; number: number; total: number; currency: string; email: string },
  ): Promise<CheckoutResult> {
    const origin = this.urls.originForHost(host);
    const destination = await this.tenantDb.run(shop.id, (tx) =>
      this.paymentAccounts.requireDestination(tx, shop.id),
    );
    const fee = applicationFee(order.total, destination.feeBps);
    let created;
    try {
      created = await this.provider.createPayment({
        storeId: shop.id,
        orderId: order.id,
        orderNumber: order.number,
        amount: order.total,
        currency: order.currency,
        email: order.email,
        successUrl: `${this.statusUrl(host, order.id)}?from=checkout`,
        cancelUrl: `${origin}/checkout?cancelled=1`,
        idempotencyKey: `checkout-${order.id}`,
        destination: { accountId: destination.accountId, applicationFee: fee },
      });
    } catch (error) {
      this.logger.error(`Payment session failed for order ${order.id}: ${String(error)}`);
      await this.tenantDb.run(shop.id, (tx) =>
        this.lifecycle.event(
          tx,
          shop.id,
          order.id,
          'payment_session_failed',
          'Could not start payment.',
        ),
      );
      throw new BadGatewayException('The payment provider is unavailable. Please try again.');
    }

    await this.tenantDb.run(shop.id, (tx) =>
      tx.payment.create({
        data: {
          storeId: shop.id,
          orderId: order.id,
          provider: this.provider.name,
          providerRef: created.providerRef,
          amount: order.total,
          currency: order.currency,
          checkoutUrl: created.checkoutUrl,
          returnUrl: created.returnUrl ?? null,
          destinationAccountId: destination.accountId,
          applicationFee: fee,
        },
      }),
    );
    return { orderNumber: order.number, paymentUrl: created.checkoutUrl };
  }

  private statusUrl(host: string, orderId: string): string {
    return `${this.urls.originForHost(host)}/orders/${this.urls.orderAccessToken(orderId)}`;
  }
}

export function toPublicOrder(
  storeName: string,
  order: Prisma.OrderGetPayload<{ include: { lines: true; fulfillments: true } }>,
): PublicOrder {
  return {
    number: order.number,
    storeName,
    status: order.status,
    financialStatus: order.financialStatus,
    fulfillmentStatus: order.fulfillmentStatus,
    currency: order.currency,
    subtotal: order.subtotal,
    discountTotal: order.discountTotal,
    shippingTotal: order.shippingTotal,
    taxTotal: order.taxTotal,
    total: order.total,
    shippingMethod: order.shippingMethod,
    shippingAddress: order.shippingAddress as PublicOrder['shippingAddress'],
    lines: order.lines.map((l) => ({
      title: l.title,
      variantTitle: l.variantTitle,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      total: l.unitPrice * l.quantity - l.discountTotal,
    })),
    fulfillments: order.fulfillments.map((f) => ({
      trackingCompany: f.trackingCompany,
      trackingNumber: f.trackingNumber,
      trackingUrl: f.trackingUrl,
      createdAt: f.createdAt.toISOString(),
    })),
    createdAt: order.createdAt.toISOString(),
  };
}
