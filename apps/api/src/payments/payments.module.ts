import { Controller, Headers, HttpCode, Module, Param, Post, Req } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { IncomingHttpHeaders } from 'node:http';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import Stripe from 'stripe';
import { Public } from '../auth/auth.guard.js';
import { ENV, type Env } from '../config/env.js';
import { OrdersCoreModule } from '../orders/orders-core.module.js';
import { CONNECT_PROVIDERS, type ConnectProvider } from './connect-provider.js';
import { ConnectWebhooksService } from './connect-webhooks.service.js';
import { MockConnectProvider } from './mock-connect.provider.js';
import { MockPaymentProvider } from './mock-payment.provider.js';
import {
  ConnectWebhooksController,
  PaymentAccountsController,
} from './payment-accounts.controller.js';
import { PaymentAccountsService } from './payment-accounts.service.js';
import { PAYMENT_PROVIDERS, type PaymentProvider } from './payment-provider.js';
import { PaymentWebhooksService } from './payment-webhooks.service.js';
import { type FetchLike, RazorpayClient } from './razorpay/razorpay-client.js';
import { RazorpayConnectProvider } from './razorpay/razorpay-connect.provider.js';
import { RazorpayPaymentProvider } from './razorpay/razorpay-payment.provider.js';
import { StripeConnectProvider } from './stripe-connect.provider.js';
import { StripePaymentProvider } from './stripe-payment.provider.js';

@ApiTags('webhooks')
@Public()
@SkipThrottle()
@Controller('webhooks/payments')
export class PaymentWebhooksController {
  constructor(private readonly webhooks: PaymentWebhooksService) {}

  @Post(':provider')
  @HttpCode(200)
  @ApiExcludeEndpoint()
  receive(
    @Param('provider') provider: string,
    @Req() req: RawBodyRequest<Request>,
    @Headers() headers: IncomingHttpHeaders,
  ) {
    return this.webhooks.handle(provider, req.rawBody, headers);
  }
}

export interface Gateways {
  payments: Map<string, PaymentProvider>;
  connect: Map<string, ConnectProvider>;
}

/**
 * Builds the adapters for every gateway in PAYMENT_PROVIDERS (env validation guarantees their
 * keys). Each store settles through the gateway it connected; webhooks are routed by name.
 */
export function createGateways(env: Env, options: { razorpayFetch?: FetchLike } = {}): Gateways {
  const payments = new Map<string, PaymentProvider>();
  const connect = new Map<string, ConnectProvider>();
  for (const name of new Set(env.PAYMENT_PROVIDERS)) {
    if (name === 'mock' && env.NODE_ENV !== 'production') {
      payments.set('mock', new MockPaymentProvider(env.MOCK_PAYMENT_WEBHOOK_SECRET));
      connect.set(
        'mock',
        new MockConnectProvider(env.MOCK_PAYMENT_WEBHOOK_SECRET, env.ADMIN_PUBLIC_URL),
      );
    }
    if (name === 'stripe' && env.STRIPE_SECRET_KEY) {
      const stripe = new Stripe(env.STRIPE_SECRET_KEY);
      payments.set('stripe', new StripePaymentProvider(stripe, env.STRIPE_WEBHOOK_SECRET ?? ''));
      connect.set(
        'stripe',
        new StripeConnectProvider(stripe, env.STRIPE_CONNECT_WEBHOOK_SECRET ?? ''),
      );
    }
    if (name === 'razorpay' && env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
      const client = new RazorpayClient(
        env.RAZORPAY_KEY_ID,
        env.RAZORPAY_KEY_SECRET,
        options.razorpayFetch,
      );
      const secret = env.RAZORPAY_WEBHOOK_SECRET ?? '';
      payments.set('razorpay', new RazorpayPaymentProvider(client, secret));
      connect.set('razorpay', new RazorpayConnectProvider(client, secret));
    }
  }
  if (payments.size === 0) throw new Error('No payment gateway is configured');
  return { payments, connect };
}

export const GATEWAYS = Symbol('GATEWAYS');

@Module({
  imports: [OrdersCoreModule],
  controllers: [PaymentWebhooksController, PaymentAccountsController, ConnectWebhooksController],
  providers: [
    { provide: GATEWAYS, inject: [ENV], useFactory: (env: Env) => createGateways(env) },
    { provide: PAYMENT_PROVIDERS, inject: [GATEWAYS], useFactory: (g: Gateways) => g.payments },
    { provide: CONNECT_PROVIDERS, inject: [GATEWAYS], useFactory: (g: Gateways) => g.connect },
    PaymentWebhooksService,
    PaymentAccountsService,
    ConnectWebhooksService,
  ],
  exports: [PAYMENT_PROVIDERS, CONNECT_PROVIDERS, PaymentWebhooksService, PaymentAccountsService],
})
export class PaymentsModule {}
