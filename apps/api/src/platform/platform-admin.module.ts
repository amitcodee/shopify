import { Module } from '@nestjs/common';
import { StorefrontModule } from '../storefront/storefront.module.js';
import { BillingController, BillingWebhooksController } from './billing.controller.js';
import { PlatformAdminController, PlatformAdminGuard } from './platform-admin.controller.js';
import { PlatformAdminService } from './platform-admin.service.js';

@Module({
  imports: [StorefrontModule],
  controllers: [PlatformAdminController, BillingController, BillingWebhooksController],
  providers: [PlatformAdminService, PlatformAdminGuard],
})
export class PlatformAdminModule {}
