import { Module } from '@nestjs/common';
import { DiscountRules, ShippingRules, TaxRules } from '../commerce/commerce-rules.js';
import { OutboxProcessor, OutboxService } from '../outbox/outbox.service.js';
import { OrderLifecycle } from './order-lifecycle.service.js';
import { StoreUrls } from './store-urls.js';

/** Order state machine, pricing rules and outbox, shared by checkout, webhooks, admin and jobs. */
@Module({
  providers: [
    OrderLifecycle,
    StoreUrls,
    OutboxService,
    OutboxProcessor,
    ShippingRules,
    TaxRules,
    DiscountRules,
  ],
  exports: [
    OrderLifecycle,
    StoreUrls,
    OutboxService,
    OutboxProcessor,
    ShippingRules,
    TaxRules,
    DiscountRules,
  ],
})
export class OrdersCoreModule {}
