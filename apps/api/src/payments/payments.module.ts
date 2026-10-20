import { Controller, Headers, HttpCode, Module, Param, Post, Req } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { IncomingHttpHeaders } from 'node:http';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../auth/auth.guard.js';
import { ENV, type Env } from '../config/env.js';
import { OrdersCoreModule } from '../orders/orders-core.module.js';
import {
  ACTIVE_CONNECT_PROVIDER,
  CONNECT_PROVIDERS,
  type ConnectProvider,
} from './connect-provider.js';
import { ConnectWebhooksService } from './connect-webhooks.service.js';
import { MockConnectProvider } from './mock-connect.provider.js';
import { MockPaymentProvider } from './mock-payment.provider.js';
import {
  ConnectWebhooksController,
  PaymentAccountsController,
} from './payment-accounts.controller.js';
import { PaymentAccountsService } from './payment-accounts.service.js';
import {
  ACTIVE_PAYMENT_PROVIDER,
  PAYMENT_PROVIDERS,
  type PaymentProvider,
} from './payment-provider.js';
import { PaymentWebhooksService } from './payment-webhooks.service.js';
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

@Module({
  imports: [OrdersCoreModule],
  controllers: [PaymentWebhooksController, PaymentAccountsController, ConnectWebhooksController],
  providers: [
    {
      provide: PAYMENT_PROVIDERS,
      inject: [ENV],
      useFactory: (env: Env): Map<string, PaymentProvider> => {
        const providers = new Map<string, PaymentProvider>();
        if (env.NODE_ENV !== 'production') {
          providers.set('mock', new MockPaymentProvider(env.MOCK_PAYMENT_WEBHOOK_SECRET));
        }
        if (env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET) {
          providers.set(
            'stripe',
            StripePaymentProvider.create(env.STRIPE_SECRET_KEY, env.STRIPE_WEBHOOK_SECRET),
          );
        }
        return providers;
      },
    },
    {
      provide: ACTIVE_PAYMENT_PROVIDER,
      inject: [ENV, PAYMENT_PROVIDERS],
      useFactory: (env: Env, providers: Map<string, PaymentProvider>): PaymentProvider => {
        const provider = providers.get(env.PAYMENT_PROVIDER);
        if (!provider)
          throw new Error(`Payment provider "${env.PAYMENT_PROVIDER}" is not configured`);
        return provider;
      },
    },
    {
      provide: CONNECT_PROVIDERS,
      inject: [ENV],
      useFactory: (env: Env): Map<string, ConnectProvider> => {
        const providers = new Map<string, ConnectProvider>();
        if (env.NODE_ENV !== 'production') {
          providers.set(
            'mock',
            new MockConnectProvider(env.MOCK_PAYMENT_WEBHOOK_SECRET, env.ADMIN_PUBLIC_URL),
          );
        }
        if (env.STRIPE_SECRET_KEY && env.STRIPE_CONNECT_WEBHOOK_SECRET) {
          providers.set(
            'stripe',
            StripeConnectProvider.create(env.STRIPE_SECRET_KEY, env.STRIPE_CONNECT_WEBHOOK_SECRET),
          );
        }
        return providers;
      },
    },
    {
      // Payouts always use the same provider as checkout.
      provide: ACTIVE_CONNECT_PROVIDER,
      inject: [ENV, CONNECT_PROVIDERS],
      useFactory: (env: Env, providers: Map<string, ConnectProvider>): ConnectProvider => {
        const provider = providers.get(env.PAYMENT_PROVIDER);
        if (!provider)
          throw new Error(`Connect provider "${env.PAYMENT_PROVIDER}" is not configured`);
        return provider;
      },
    },
    PaymentWebhooksService,
    PaymentAccountsService,
    ConnectWebhooksService,
  ],
  exports: [
    PAYMENT_PROVIDERS,
    ACTIVE_PAYMENT_PROVIDER,
    PaymentWebhooksService,
    PaymentAccountsService,
  ],
})
export class PaymentsModule {}
