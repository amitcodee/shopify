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
import {
  type Cart,
  type CheckoutPreview,
  type CheckoutPreviewInput,
  type CheckoutResult,
  type checkoutInputSchema,
  formatMoney,
  minorUnitFactor,
  type MockPayment,
  type PublicOrder,
  type ShippingOption,
  type LineProperty,
  parseLineProperties,
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
import { GiftCardLedger } from '../gift-cards/gift-card-ledger.js';
import {
  CASH_ON_DELIVERY,
  GIFT_CARD_PAYMENT,
  OrderLifecycle,
} from '../orders/order-lifecycle.service.js';
import { PlanLimits } from '../platform/plans.service.js';
import { StoreUrls } from '../orders/store-urls.js';
import { applicationFee } from '../payments/connect-provider.js';
import { PaymentAccountsService } from '../payments/payment-accounts.service.js';
import { OWN_ACCOUNT } from '../payments/store-gateways/adapters.js';
import { StoreGatewaysService } from '../payments/store-gateways/store-gateways.service.js';
import { PAYMENT_PROVIDERS, type PaymentProvider } from '../payments/payment-provider.js';
import { CartService, lineCustomization } from '../storefront/cart.service.js';
import { type ShopContext, shopAmount, shopPrice } from '../storefront/store-resolver.js';
import { hashToken } from '../auth/session.service.js';
import { returnedQuantities, returnWindowOpen } from '../orders/return-rules.js';
import { priceCart, type PricingResult } from './pricing.js';

type CheckoutInput = z.output<typeof checkoutInputSchema>;

interface Quote {
  cart: Cart;
  pricing: PricingResult;
  requiresShipping: boolean;
  shippingOptions: ShippingOption[];
  selectedShipping: ShippingOption | null;
  discount: DiscountEvaluation | null;
  /** Gift card the shopper entered, if usable, and how much of the total it covers. */
  giftCard: { lastCharacters: string; applied: number; remaining: number } | null;
  giftCardError: string | null;
  amountDue: number;
  lines: {
    variantId: string;
    productId: string;
    title: string;
    variantTitle: string;
    sku: string | null;
    unitPrice: number;
    /** Price in the store currency (unitPrice is in the shopper's currency). */
    basePrice: number;
    quantity: number;
    taxable: boolean;
    requiresShipping: boolean;
    weightGrams: number;
    trackInventory: boolean;
    isGiftCard: boolean;
    discountable: boolean;
    /** Customizations as sold (prices in the shopper's currency, included in unitPrice). */
    properties: LineProperty[];
  }[];
}

const MAX_PENDING_ORDERS_PER_EMAIL = 3;
/** Open (undelivered, unpaid) cash-on-delivery orders one phone number may have per store. */
const MAX_OPEN_COD_ORDERS_PER_PHONE = 3;

/** Compares Indian and international numbers by their last 10 digits ("+91 98…" = "098…"). */
export function phoneKey(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10);
}

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
    private readonly storeGateways: StoreGatewaysService,
    private readonly giftCards: GiftCardLedger,
    @Inject(PAYMENT_PROVIDERS) private readonly providers: Map<string, PaymentProvider>,
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
        phoneRequired: (await this.storeGateways.active(tx, shop.id))?.info.requiresPhone ?? false,
        cashOnDelivery: await this.codAvailable(tx, shop, quote),
        giftCard: quote.giftCard,
        giftCardError: quote.giftCardError,
        amountDue: quote.amountDue,
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
        giftCardCode: input.giftCardCode,
      });
      if (quote.requiresShipping && !quote.selectedShipping) {
        throw new BadRequestException('We do not ship to this address.');
      }
      if (input.discountCode && !quote.discount?.applied) {
        throw new BadRequestException(
          quote.discount?.message ?? 'This discount code is not valid.',
        );
      }
      if (quote.giftCardError) throw new BadRequestException(quote.giftCardError);
      // Paid orders need somewhere to settle: no stock is reserved for a store that cannot
      // take payments yet.
      const cod = input.paymentMethod === 'cod' && quote.amountDue > 0;
      if (cod && !(await this.codAvailable(tx, shop, quote))) {
        throw new BadRequestException('Cash on delivery is not available for this order.');
      }
      if (cod && !input.shippingAddress.phone) {
        throw new BadRequestException('Enter a phone number for delivery.');
      }
      if (cod && input.shippingAddress.phone) {
        await this.assertCodPhoneLimit(tx, shop.id, input.shippingAddress.phone);
      }
      const destination =
        quote.amountDue > 0 && !cod
          ? await this.paymentAccounts.requireDestination(tx, shop.id)
          : null;
      if (destination?.requiresPhone && !input.shippingAddress.phone) {
        throw new BadRequestException('Enter a phone number to pay for this order.');
      }
      if (destination && shop.currency !== shop.baseCurrency) {
        await this.paymentAccounts.requireCurrency(destination.provider, shop.currency);
      }

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

      const created = await tx.order.create({
        data: {
          storeId: shop.id,
          number: await this.lifecycle.allocateOrderNumber(tx, shop.id),
          customerId: customer.id,
          email,
          currency: shop.currency,
          exchangeRate: shop.presentment
            ? minorUnitFactor(shop.baseCurrency, shop.currency, shop.presentment.rate)
            : 1,
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
          paymentProvider: cod ? CASH_ON_DELIVERY : (destination?.provider ?? 'none'),
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
              isGiftCard: l.isGiftCard,
              properties: l.properties,
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

      await this.lifecycle.reserveStock(tx, shop.id, created.id, created.lines);
      const placed = input.giftCardCode
        ? await this.redeemGiftCard(tx, shop, created, input.giftCardCode, quote.amountDue)
        : created;
      await this.lifecycle.event(
        tx,
        shop.id,
        created.id,
        'placed',
        `Order placed by ${created.email}.`,
      );

      if (placed.total - placed.giftCardAmount === 0) {
        await this.lifecycle.markFreeOrderPaid(tx, shop.id, placed);
      } else if (cod) {
        const { codRequireConfirmation } = await tx.store.findUniqueOrThrow({
          where: { id: shop.id },
          select: { codRequireConfirmation: true },
        });
        if (codRequireConfirmation) {
          await this.lifecycle.requestCashOnDeliveryConfirmation(tx, shop.id, placed);
        } else {
          await this.lifecycle.confirmCashOnDelivery(tx, shop.id, placed);
        }
      }
      return placed;
    });

    if (order.paymentProvider === CASH_ON_DELIVERY) {
      return {
        orderNumber: order.number,
        paymentUrl: `${this.statusUrl(host, order.id)}?from=checkout`,
      };
    }
    if (order.total - order.giftCardAmount === 0) {
      return { orderNumber: order.number, paymentUrl: this.statusUrl(host, order.id) };
    }
    return this.openPayment(shop, host, order);
  }

  /**
   * Cash can only change hands on a delivery, in the store's own currency. Gift cards are issued
   * on payment, so buying one in cash would need the code emailed before the money arrives.
   */
  private async codAvailable(tx: TenantTx, shop: ShopContext, quote: Quote): Promise<boolean> {
    if (quote.amountDue <= 0 || !quote.requiresShipping || shop.currency !== shop.baseCurrency) {
      return false;
    }
    if (quote.lines.some((l) => l.isGiftCard)) return false;
    const store = await tx.store.findUniqueOrThrow({
      where: { id: shop.id },
      select: { codEnabled: true, codMaxAmount: true },
    });
    return (
      store.codEnabled && (store.codMaxAmount === null || quote.amountDue <= store.codMaxAmount)
    );
  }

  /**
   * Fake-order protection: a phone number with several cash orders still awaiting delivery cannot
   * place another until those are delivered, paid or cancelled.
   */
  private async assertCodPhoneLimit(tx: TenantTx, storeId: string, phone: string): Promise<void> {
    const key = phoneKey(phone);
    if (key.length < 6) throw new BadRequestException('Enter a valid phone number for delivery.');
    const open = await tx.order.findMany({
      where: {
        storeId,
        paymentProvider: CASH_ON_DELIVERY,
        status: { in: ['PENDING_PAYMENT', 'OPEN'] },
        paidAt: null,
        fulfillmentStatus: { not: 'FULFILLED' },
        createdAt: { gt: new Date(Date.now() - 60 * 24 * 60 * 60_000) },
      },
      select: { shippingAddress: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    const samePhone = open.filter((o) => {
      const value = (o.shippingAddress as { phone?: unknown } | null)?.phone;
      return typeof value === 'string' && phoneKey(value) === key;
    }).length;
    if (samePhone >= MAX_OPEN_COD_ORDERS_PER_PHONE) {
      throw new HttpException(
        'This phone number already has cash on delivery orders waiting for delivery. Please pay online or wait for them to arrive.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /** The shopper confirmed a cash-on-delivery order from the link in their email. */
  async confirmCashOnDelivery(
    shop: ShopContext,
    host: string,
    token: string,
  ): Promise<{ orderNumber: number; statusUrl: string; alreadyConfirmed: boolean }> {
    const result = await this.tenantDb.run(shop.id, async (tx) => {
      const confirmed = await this.lifecycle.confirmCashOnDeliveryByToken(tx, shop.id, token);
      if (!confirmed) return null;
      const order = await tx.order.findUniqueOrThrow({
        where: { id: confirmed.orderId },
        select: { number: true },
      });
      return { ...confirmed, number: order.number };
    });
    if (!result) {
      throw new NotFoundException(
        'This confirmation link is not valid any more. The order may have expired; please order again.',
      );
    }
    return {
      orderNumber: result.number,
      statusUrl: this.statusUrl(host, result.orderId),
      alreadyConfirmed: result.alreadyConfirmed,
    };
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
        include: publicOrderInclude,
      }),
    );
    if (!order) throw new NotFoundException('Order not found.');
    return toPublicOrder(shop.name, order);
  }

  async findMockPayment(shop: ShopContext, reference: string) {
    if (!this.providers.has('mock')) throw new NotFoundException();
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
    const rows = await tx.cartLine.findMany({
      where: { storeId: shop.id, id: { in: available.map((l) => l.id) } },
      include: {
        variant: { include: { product: { select: { isGiftCard: true, customizations: true } } } },
      },
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    const lines = available.flatMap((l) => {
      const row = byId.get(l.id);
      const custom = row ? lineCustomization(row) : null;
      if (!row || !custom?.ok) return [];
      const v = row.variant;
      const basePrice = v.price + custom.extra;
      return [
        {
          variantId: v.id,
          productId: v.productId,
          title: l.productTitle,
          variantTitle: l.variantTitle,
          sku: v.sku,
          unitPrice: shopPrice(shop, basePrice),
          basePrice,
          quantity: l.quantity,
          taxable: v.taxable,
          requiresShipping: v.requiresShipping,
          weightGrams: v.weightGrams,
          trackInventory: v.trackInventory,
          isGiftCard: v.product.isGiftCard,
          discountable: !v.product.isGiftCard,
          properties: custom.properties.map((p) => ({ ...p, price: shopPrice(shop, p.price) })),
        },
      ];
    });

    // Rate conditions and discount minimums are configured in the store currency.
    const baseSubtotal = lines.reduce((s, l) => s + l.basePrice * l.quantity, 0);
    const requiresShipping = lines.some((l) => l.requiresShipping);
    const destination = { country: input.country, region: input.region };
    const baseOptions = await this.shipping.optionsFor(tx, shop.id, destination, {
      subtotal: baseSubtotal,
      weightGrams: lines.reduce(
        (s, l) => s + (l.requiresShipping ? l.weightGrams * l.quantity : 0),
        0,
      ),
      requiresShipping,
    });
    const shippingOptions = baseOptions.map((o) => ({ ...o, price: shopAmount(shop, o.price) }));
    const selectedShipping =
      shippingOptions.find((o) => o.id === input.shippingRateId) ?? shippingOptions[0] ?? null;
    const discount = input.discountCode
      ? await this.discounts.evaluate(tx, shop.id, input.discountCode, baseSubtotal)
      : null;
    const rule = discount?.applied ? discount.rule : null;
    const discountRule =
      rule?.type === 'FIXED_AMOUNT' ? { ...rule, value: shopAmount(shop, rule.value) } : rule;
    const tax = input.country
      ? await this.tax.rateFor(tx, shop.id, destination)
      : { rateBps: 0, taxShipping: false };

    const pricing = priceCart({
      lines,
      discount: discountRule,
      shippingPrice: selectedShipping?.price ?? 0,
      taxRateBps: tax.rateBps,
      taxShipping: tax.taxShipping,
    });
    let giftCard: Quote['giftCard'] = null;
    let giftCardError: string | null = null;
    if (input.giftCardCode && lines.some((l) => l.isGiftCard)) {
      giftCardError = 'Gift cards can’t be used to buy gift cards.';
    } else if (input.giftCardCode) {
      const usable = await this.giftCards.findUsable(
        tx,
        shop.id,
        input.giftCardCode,
        shop.currency,
      );
      if (usable.card) {
        const applied = Math.min(usable.card.balance, pricing.total);
        giftCard = {
          lastCharacters: usable.card.lastCharacters,
          applied,
          remaining: usable.card.balance - applied,
        };
      } else {
        giftCardError = usable.error;
      }
    }
    return {
      cart,
      pricing,
      requiresShipping,
      shippingOptions,
      selectedShipping,
      discount,
      lines,
      giftCard,
      giftCardError,
      amountDue: pricing.total - (giftCard?.applied ?? 0),
    };
  }

  /**
   * Spends the gift card on a just-created order (locked, so two checkouts cannot spend the same
   * balance) and records it as an already-settled payment. Fails if the balance changed since
   * the shopper saw the total, because the amount to charge would differ.
   */
  private async redeemGiftCard<T extends { id: string; total: number; currency: string }>(
    tx: TenantTx,
    shop: ShopContext,
    order: T,
    code: string,
    expectedDue: number,
  ): Promise<T & { giftCardAmount: number }> {
    const redeemed = await this.giftCards.redeem(
      tx,
      shop.id,
      code,
      shop.currency,
      order.total,
      order.id,
    );
    if (!redeemed.card) throw new BadRequestException(redeemed.error);
    if (order.total - redeemed.amount !== expectedDue) {
      throw new ConflictException('Your gift card balance changed. Please review your order.');
    }
    await tx.order.update({
      where: { id: order.id },
      data: { giftCardId: redeemed.card.id, giftCardAmount: redeemed.amount },
    });
    await tx.payment.create({
      data: {
        storeId: shop.id,
        orderId: order.id,
        provider: GIFT_CARD_PAYMENT,
        providerRef: `gift-card-${order.id}`,
        amount: redeemed.amount,
        currency: order.currency,
        status: 'SUCCEEDED',
      },
    });
    await this.lifecycle.event(
      tx,
      shop.id,
      order.id,
      'gift_card_applied',
      `Gift card •••• ${redeemed.card.lastCharacters} covers ${formatMoney(redeemed.amount, order.currency)}.`,
    );
    return { ...order, giftCardAmount: redeemed.amount };
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

  /** Opens a provider payment session for an unpaid order; `cancelPath` is where "back" leads. */
  async openPayment(
    shop: ShopContext,
    host: string,
    order: {
      id: string;
      number: number;
      total: number;
      giftCardAmount: number;
      currency: string;
      email: string;
    },
    cancelPath = '/checkout?cancelled=1',
  ): Promise<CheckoutResult> {
    // A gift card already paid part of the order; the provider charges the rest.
    const amount = order.total - order.giftCardAmount;
    const origin = this.urls.originForHost(host);
    const destination = await this.tenantDb.run(shop.id, (tx) =>
      this.paymentAccounts.requireDestination(tx, shop.id),
    );
    const fee = applicationFee(amount, destination.feeBps);
    const own = destination.accountId === OWN_ACCOUNT;
    const provider = own
      ? await this.storeGateways.forProviderName(shop.id, destination.provider)
      : this.providers.get(destination.provider);
    const address = await this.tenantDb.run(shop.id, async (tx) => {
      const row = await tx.order.findUniqueOrThrow({
        where: { id: order.id },
        select: { shippingAddress: true },
      });
      return row.shippingAddress as { name?: string; phone?: string };
    });
    if (!provider) throw new BadGatewayException('The payment provider is unavailable.');
    let created;
    try {
      created = await provider.createPayment({
        storeId: shop.id,
        orderId: order.id,
        orderNumber: order.number,
        amount,
        currency: order.currency,
        email: order.email,
        phone: address.phone,
        customerName: address.name,
        successUrl: `${this.statusUrl(host, order.id)}?from=checkout`,
        cancelUrl: `${origin}${cancelPath}`,
        idempotencyKey: `checkout-${order.id}`,
        destination: own ? null : { accountId: destination.accountId, applicationFee: fee },
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
          provider: provider.name,
          providerRef: created.providerRef,
          amount,
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

/** What the shopper-facing order views need (lines, shipments, returns). */
export const publicOrderInclude = {
  lines: true,
  fulfillments: { orderBy: { createdAt: 'asc' } },
  returns: { include: { lines: true }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.OrderInclude;

export function toPublicOrder(
  storeName: string,
  order: Prisma.OrderGetPayload<{ include: typeof publicOrderInclude }>,
): PublicOrder {
  const returned = returnedQuantities(order.returns);
  const titles = new Map(order.lines.map((l) => [l.id, l.title]));
  const lines = order.lines.map((l) => ({
    id: l.id,
    title: l.title,
    variantTitle: l.variantTitle,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    total: l.unitPrice * l.quantity - l.discountTotal,
    properties: parseLineProperties(l.properties),
    returnableQuantity: Math.max(0, l.quantity - (returned.get(l.id) ?? 0)),
  }));
  return {
    cashOnDelivery: order.paymentProvider === CASH_ON_DELIVERY,
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
    giftCardAmount: order.giftCardAmount,
    shippingMethod: order.shippingMethod,
    shippingAddress: order.shippingAddress as PublicOrder['shippingAddress'],
    lines,
    returnable: returnWindowOpen(order) && lines.some((l) => l.returnableQuantity > 0),
    returns: order.returns.map((r) => ({
      status: r.status,
      declineReason: r.declineReason,
      lines: r.lines.map((rl) => ({
        title: titles.get(rl.orderLineId) ?? 'Item',
        quantity: rl.quantity,
      })),
      createdAt: r.createdAt.toISOString(),
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
