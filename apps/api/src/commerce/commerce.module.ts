import { Module } from '@nestjs/common';
import { AnalyticsController, AnalyticsService } from '../analytics/analytics.js';
import { AuthModule } from '../auth/auth.module.js';
import {
  AbandonedCheckoutsController,
  CartRecoveryController,
} from '../checkout/checkout-recovery.controller.js';
import { CheckoutRecoveryService } from '../checkout/checkout-recovery.service.js';
import { CheckoutController } from '../checkout/checkout.controller.js';
import { CheckoutService } from '../checkout/checkout.service.js';
import { CustomerAuthService } from '../customers/customer-auth.service.js';
import { AdminCustomersController, AdminCustomersService } from '../customers/customers.admin.js';
import {
  CustomerPrivacyController,
  CustomerPrivacyService,
} from '../customers/customer-privacy.js';
import { MaintenanceService } from '../jobs/maintenance.service.js';
import { JobsService } from '../jobs/jobs.service.js';
import { OrdersCoreModule } from '../orders/orders-core.module.js';
import { DraftOrdersController, InvoicesController } from '../orders/draft-orders.controller.js';
import { DraftOrdersService } from '../orders/draft-orders.service.js';
import { OrdersController } from '../orders/orders.controller.js';
import { OrdersService } from '../orders/orders.service.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { StorefrontModule } from '../storefront/storefront.module.js';

/** Checkout, orders, customers, analytics and the background jobs that serve them. */
@Module({
  imports: [AuthModule, StorefrontModule, PaymentsModule, OrdersCoreModule],
  controllers: [
    CheckoutController,
    CartRecoveryController,
    AbandonedCheckoutsController,
    OrdersController,
    DraftOrdersController,
    InvoicesController,
    AdminCustomersController,
    CustomerPrivacyController,
    AnalyticsController,
  ],
  providers: [
    CheckoutService,
    CheckoutRecoveryService,
    CustomerAuthService,
    OrdersService,
    DraftOrdersService,
    AdminCustomersService,
    AnalyticsService,
    JobsService,
    CustomerPrivacyService,
    MaintenanceService,
  ],
})
export class CommerceModule {}
