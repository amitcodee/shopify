import { Global, Module } from '@nestjs/common';
import Stripe from 'stripe';
import { ENV, type Env } from '../config/env.js';
import {
  BILLING_PROVIDER,
  MockBillingProvider,
  StripeBillingProvider,
} from './billing-provider.js';
import { BillingService } from './billing.service.js';
import { PlatformSettingsService } from './platform-settings.service.js';
import { PlanLimits, PlansService } from './plans.service.js';
import { RAZORPAY_BILLING, RazorpayBilling } from './razorpay-billing.js';

/** Plans, limits, billing and platform settings — used across catalog, staff, checkout and admin. */
@Global()
@Module({
  providers: [
    PlansService,
    PlanLimits,
    BillingService,
    PlatformSettingsService,
    {
      provide: BILLING_PROVIDER,
      inject: [ENV],
      useFactory: (env: Env) =>
        env.BILLING_PROVIDER === 'stripe' && env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET
          ? new StripeBillingProvider(new Stripe(env.STRIPE_SECRET_KEY), env.STRIPE_WEBHOOK_SECRET)
          : new MockBillingProvider(),
    },
    {
      provide: RAZORPAY_BILLING,
      inject: [ENV],
      useFactory: (env: Env) =>
        env.BILLING_PROVIDER === 'razorpay' &&
        env.BILLING_RAZORPAY_KEY_ID &&
        env.BILLING_RAZORPAY_KEY_SECRET &&
        env.BILLING_RAZORPAY_WEBHOOK_SECRET
          ? new RazorpayBilling(
              env.BILLING_RAZORPAY_KEY_ID,
              env.BILLING_RAZORPAY_KEY_SECRET,
              env.BILLING_RAZORPAY_WEBHOOK_SECRET,
            )
          : null,
    },
  ],
  exports: [PlansService, PlanLimits, BillingService, PlatformSettingsService],
})
export class PlatformCoreModule {}
