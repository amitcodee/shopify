import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type CheckoutPreview,
  type CheckoutResult,
  checkoutInputSchema,
  checkoutPreviewInputSchema,
  customerEmailInputSchema,
  customerLoginInputSchema,
  customerRegisterInputSchema,
  customerTokenInputSchema,
  type CustomerAccount,
  type CustomerRegisterResult,
  type CustomerSession,
  type MockPayment,
  mockPaymentOutcomeSchema,
  type PublicOrder,
  STOREFRONT_HEADERS,
} from '@repo/contracts';
import type { Request } from 'express';
import type { z } from 'zod';
import { Public } from '../auth/auth.guard.js';
import { ApiZodBody, ZodPipe } from '../common/zod.js';
import { CustomerAuthService } from '../customers/customer-auth.service.js';
import { MockPaymentProvider, MOCK_SIGNATURE_HEADER } from '../payments/mock-payment.provider.js';
import { PAYMENT_PROVIDERS, type PaymentProvider } from '../payments/payment-provider.js';
import { PaymentWebhooksService } from '../payments/payment-webhooks.service.js';
import {
  AllowLockedStore,
  CartToken,
  CurrentShop,
  StorefrontGuard,
} from '../storefront/storefront.guard.js';
import type { ShopContext } from '../storefront/store-resolver.js';
import { CheckoutService } from './checkout.service.js';

function customerToken(req: Request): string | null {
  const value = req.headers[STOREFRONT_HEADERS.customer];
  const token = Array.isArray(value) ? value[0] : value;
  return token && token.length <= 200 ? token : null;
}

export function signedHost(req: Request): string {
  const value = req.headers[STOREFRONT_HEADERS.host];
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

@ApiTags('storefront')
@Public()
@UseGuards(StorefrontGuard)
@Controller('storefront')
export class CheckoutController {
  constructor(
    private readonly checkout: CheckoutService,
    private readonly customers: CustomerAuthService,
    private readonly webhooks: PaymentWebhooksService,
    @Inject(PAYMENT_PROVIDERS) private readonly providers: Map<string, PaymentProvider>,
  ) {}

  @Post('checkout/preview')
  @HttpCode(200)
  @ApiZodBody(checkoutPreviewInputSchema)
  preview(
    @CurrentShop() shop: ShopContext,
    @CartToken() cart: string | null,
    @Body(new ZodPipe(checkoutPreviewInputSchema))
    body: z.output<typeof checkoutPreviewInputSchema>,
  ): Promise<CheckoutPreview> {
    return this.checkout.preview(shop, cart, body);
  }

  @Post('checkout')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiZodBody(checkoutInputSchema)
  async place(
    @CurrentShop() shop: ShopContext,
    @CartToken() cart: string | null,
    @Req() req: Request,
    @Body(new ZodPipe(checkoutInputSchema)) body: z.output<typeof checkoutInputSchema>,
  ): Promise<CheckoutResult> {
    const customer = await this.customers.current(shop, customerToken(req));
    return this.checkout.place(shop, signedHost(req), cart, customer?.id ?? null, body);
  }

  @AllowLockedStore()
  @Get('checkout/mock-payments/:reference')
  mockPayment(
    @CurrentShop() shop: ShopContext,
    @Param('reference') reference: string,
  ): Promise<MockPayment> {
    return this.checkout.getMockPayment(shop, reference);
  }

  /** Sandbox only: simulates the provider completing (or declining) the payment. */
  @AllowLockedStore()
  @Post('checkout/mock-payments/:reference')
  @HttpCode(200)
  @ApiZodBody(mockPaymentOutcomeSchema)
  async completeMockPayment(
    @CurrentShop() shop: ShopContext,
    @Param('reference') reference: string,
    @Body(new ZodPipe(mockPaymentOutcomeSchema)) body: z.output<typeof mockPaymentOutcomeSchema>,
  ): Promise<MockPayment> {
    const sandbox = this.providers.get('mock');
    if (!(sandbox instanceof MockPaymentProvider)) throw new NotFoundException();
    const payment = await this.checkout.findMockPayment(shop, reference);
    if (payment.status === 'PENDING') {
      const hook = sandbox.buildWebhook(reference, body.outcome, payment.amount, payment.currency);
      await this.webhooks.handle('mock', hook.body, { [MOCK_SIGNATURE_HEADER]: hook.signature });
    }
    return this.checkout.getMockPayment(shop, reference);
  }

  @AllowLockedStore()
  @Get('orders/:token')
  order(@CurrentShop() shop: ShopContext, @Param('token') token: string): Promise<PublicOrder> {
    return this.checkout.publicOrder(shop, token.slice(0, 200));
  }

  // ── Customer accounts ──────────────────────────────────────────────────────

  @Post('customers/register')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiZodBody(customerRegisterInputSchema)
  register(
    @CurrentShop() shop: ShopContext,
    @Req() req: Request,
    @Body(new ZodPipe(customerRegisterInputSchema))
    body: z.output<typeof customerRegisterInputSchema>,
  ): Promise<CustomerRegisterResult> {
    return this.customers.register(shop, signedHost(req), body);
  }

  @Post('customers/login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiZodBody(customerLoginInputSchema)
  login(
    @CurrentShop() shop: ShopContext,
    @Body(new ZodPipe(customerLoginInputSchema)) body: z.output<typeof customerLoginInputSchema>,
  ): Promise<CustomerSession> {
    return this.customers.login(shop, body.email, body.password);
  }

  @Post('customers/logout')
  @HttpCode(204)
  async logout(@CurrentShop() shop: ShopContext, @Req() req: Request): Promise<void> {
    await this.customers.logout(shop, customerToken(req));
  }

  @Post('customers/password-reset')
  @HttpCode(202)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiZodBody(customerEmailInputSchema)
  async requestReset(
    @CurrentShop() shop: ShopContext,
    @Req() req: Request,
    @Body(new ZodPipe(customerEmailInputSchema)) body: z.output<typeof customerEmailInputSchema>,
  ): Promise<{ status: 'sent' }> {
    await this.customers.requestPasswordReset(shop, signedHost(req), body.email);
    return { status: 'sent' };
  }

  @Post('customers/activate')
  @HttpCode(200)
  @ApiZodBody(customerTokenInputSchema)
  activate(
    @CurrentShop() shop: ShopContext,
    @Body(new ZodPipe(customerTokenInputSchema)) body: z.output<typeof customerTokenInputSchema>,
  ): Promise<CustomerSession> {
    return this.customers.completeLink(shop, 'ACTIVATE', body.token, body.password);
  }

  @Post('customers/reset')
  @HttpCode(200)
  @ApiZodBody(customerTokenInputSchema)
  reset(
    @CurrentShop() shop: ShopContext,
    @Body(new ZodPipe(customerTokenInputSchema)) body: z.output<typeof customerTokenInputSchema>,
  ): Promise<CustomerSession> {
    return this.customers.completeLink(shop, 'RESET_PASSWORD', body.token, body.password);
  }

  @Get('customers/me')
  me(@CurrentShop() shop: ShopContext, @Req() req: Request): Promise<CustomerAccount> {
    return this.customers.account(shop, customerToken(req));
  }

  @Get('customers/me/orders/:number')
  myOrder(
    @CurrentShop() shop: ShopContext,
    @Req() req: Request,
    @Param('number', ParseIntPipe) number: number,
  ): Promise<PublicOrder> {
    return this.customers.accountOrder(shop, customerToken(req), number);
  }
}
