import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  type Paginated,
  type PurchaseOrder,
  purchaseOrderActionSchema,
  purchaseOrderInputSchema,
  type PurchaseOrderListItem,
  purchaseOrderListQuerySchema,
  purchaseOrderReceiveInputSchema,
  type ReorderSuggestion,
  type Supplier,
  supplierInputSchema,
} from '@repo/contracts';
import type { z } from 'zod';
import type { AuthUser, RequestMeta, StoreContext } from '../common/request.js';
import { CurrentStore, CurrentUser, ReqMeta } from '../common/request.js';
import { UuidParam } from '../common/uuid-param.pipe.js';
import { ApiZodBody, ZodPipe } from '../common/zod.js';
import { RequirePermission, StoreAccessGuard } from '../tenancy/store-access.guard.js';
import { PurchaseOrdersService } from './purchase-orders.service.js';
import { SuppliersService } from './suppliers.service.js';

@ApiTags('purchasing')
@ApiBearerAuth()
@UseGuards(StoreAccessGuard)
@Controller('admin/stores/:storeId/suppliers')
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get()
  @RequirePermission('products:read')
  list(@CurrentStore() store: StoreContext): Promise<Supplier[]> {
    return this.suppliers.list(store.id);
  }

  @Post()
  @RequirePermission('products:write')
  @ApiZodBody(supplierInputSchema)
  create(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(supplierInputSchema)) body: z.output<typeof supplierInputSchema>,
    @ReqMeta() meta: RequestMeta,
  ): Promise<Supplier> {
    return this.suppliers.save(store.id, null, body, user, meta);
  }

  @Get(':supplierId')
  @RequirePermission('products:read')
  get(
    @CurrentStore() store: StoreContext,
    @Param('supplierId', UuidParam) id: string,
  ): Promise<Supplier> {
    return this.suppliers.get(store.id, id);
  }

  @Put(':supplierId')
  @RequirePermission('products:write')
  @ApiZodBody(supplierInputSchema)
  update(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('supplierId', UuidParam) id: string,
    @Body(new ZodPipe(supplierInputSchema)) body: z.output<typeof supplierInputSchema>,
    @ReqMeta() meta: RequestMeta,
  ): Promise<Supplier> {
    return this.suppliers.save(store.id, id, body, user, meta);
  }

  @Delete(':supplierId')
  @HttpCode(204)
  @RequirePermission('products:write')
  remove(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('supplierId', UuidParam) id: string,
    @ReqMeta() meta: RequestMeta,
  ): Promise<void> {
    return this.suppliers.remove(store.id, id, user, meta);
  }

  /** Low-stock items of this supplier's products, with suggested order quantities. */
  @Get(':supplierId/reorder')
  @RequirePermission('products:read')
  reorder(
    @CurrentStore() store: StoreContext,
    @Param('supplierId', UuidParam) id: string,
  ): Promise<ReorderSuggestion[]> {
    return this.suppliers.reorder(store.id, id);
  }
}

@ApiTags('purchasing')
@ApiBearerAuth()
@UseGuards(StoreAccessGuard)
@Controller('admin/stores/:storeId/purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly orders: PurchaseOrdersService) {}

  @Get()
  @RequirePermission('products:read')
  list(
    @CurrentStore() store: StoreContext,
    @Query(new ZodPipe(purchaseOrderListQuerySchema))
    query: z.output<typeof purchaseOrderListQuerySchema>,
  ): Promise<Paginated<PurchaseOrderListItem>> {
    return this.orders.list(store.id, query);
  }

  @Post()
  @RequirePermission('products:write')
  @ApiZodBody(purchaseOrderInputSchema)
  create(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(purchaseOrderInputSchema)) body: z.output<typeof purchaseOrderInputSchema>,
    @ReqMeta() meta: RequestMeta,
  ): Promise<PurchaseOrder> {
    return this.orders.create(store.id, body, user, meta);
  }

  @Get(':purchaseOrderId')
  @RequirePermission('products:read')
  get(
    @CurrentStore() store: StoreContext,
    @Param('purchaseOrderId', UuidParam) id: string,
  ): Promise<PurchaseOrder> {
    return this.orders.get(store.id, id);
  }

  @Put(':purchaseOrderId')
  @RequirePermission('products:write')
  @ApiZodBody(purchaseOrderInputSchema)
  update(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('purchaseOrderId', UuidParam) id: string,
    @Body(new ZodPipe(purchaseOrderInputSchema)) body: z.output<typeof purchaseOrderInputSchema>,
    @ReqMeta() meta: RequestMeta,
  ): Promise<PurchaseOrder> {
    return this.orders.update(store.id, id, body, user, meta);
  }

  @Delete(':purchaseOrderId')
  @HttpCode(204)
  @RequirePermission('products:write')
  remove(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('purchaseOrderId', UuidParam) id: string,
    @ReqMeta() meta: RequestMeta,
  ): Promise<void> {
    return this.orders.remove(store.id, id, user, meta);
  }

  @Post(':purchaseOrderId/actions')
  @HttpCode(200)
  @RequirePermission('products:write')
  @ApiZodBody(purchaseOrderActionSchema)
  action(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('purchaseOrderId', UuidParam) id: string,
    @Body(new ZodPipe(purchaseOrderActionSchema)) body: z.output<typeof purchaseOrderActionSchema>,
    @ReqMeta() meta: RequestMeta,
  ): Promise<PurchaseOrder> {
    return this.orders.action(store.id, id, body, user, meta);
  }

  @Post(':purchaseOrderId/receive')
  @HttpCode(200)
  @RequirePermission('products:write')
  @ApiZodBody(purchaseOrderReceiveInputSchema)
  receive(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('purchaseOrderId', UuidParam) id: string,
    @Body(new ZodPipe(purchaseOrderReceiveInputSchema))
    body: z.output<typeof purchaseOrderReceiveInputSchema>,
    @ReqMeta() meta: RequestMeta,
  ): Promise<PurchaseOrder> {
    return this.orders.receive(store.id, id, body, user, meta);
  }
}
