import { Module } from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service.js';
import { PurchaseOrdersController, SuppliersController } from './purchasing.controller.js';
import { SuppliersService } from './suppliers.service.js';

/** Suppliers and purchase orders (receiving stock into locations). */
@Module({
  controllers: [SuppliersController, PurchaseOrdersController],
  providers: [SuppliersService, PurchaseOrdersService],
})
export class PurchasingModule {}
