import { Module } from '@nestjs/common';
import { StorefrontModule } from '../storefront/storefront.module.js';
import { BillingController, BillingWebhooksController } from './billing.controller.js';
import { TemplatePurchasesController } from './template-purchases.js';
import { PlatformAdminController, PlatformAdminGuard } from './platform-admin.controller.js';
import { PlatformAdminService } from './platform-admin.service.js';
import { PublicPlansController } from './public-plans.controller.js';

@Module({
  imports: [StorefrontModule],
  controllers: [
    PlatformAdminController,
    BillingController,
    TemplatePurchasesController,
    BillingWebhooksController,
    PublicPlansController,
  ],
  providers: [PlatformAdminService, PlatformAdminGuard],
})
export class PlatformAdminModule {}
