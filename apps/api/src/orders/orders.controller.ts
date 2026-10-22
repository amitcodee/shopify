import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  cancelOrderInputSchema,
  fulfillInputSchema,
  type OrderDetail,
  type OrderListItem,
  type OrderListQuery,
  orderListQuerySchema,
  type Paginated,
  refundInputSchema,
} from '@repo/contracts';
import type { z } from 'zod';
import type { AuthUser, RequestMeta, StoreContext } from '../common/request.js';
import { CurrentStore, CurrentUser, ReqMeta } from '../common/request.js';
import { UuidParam } from '../common/uuid-param.pipe.js';
import { ApiZodBody, ZodPipe } from '../common/zod.js';
import { RequirePermission, StoreAccessGuard } from '../tenancy/store-access.guard.js';
import { OrdersService } from './orders.service.js';

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(StoreAccessGuard)
@Controller('admin/stores/:storeId/orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  @RequirePermission('orders:read')
  list(
    @CurrentStore() store: StoreContext,
    @Query(new ZodPipe(orderListQuerySchema)) query: OrderListQuery,
  ): Promise<Paginated<OrderListItem>> {
    return this.orders.list(store.id, query);
  }

  @Get('export')
  @RequirePermission('orders:read')
  exportCsv(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Query(new ZodPipe(orderListQuerySchema)) query: OrderListQuery,
    @ReqMeta() meta: RequestMeta,
  ): Promise<{ filename: string; csv: string }> {
    return this.orders.exportCsv(store.id, query, user, meta);
  }

  @Get(':orderId')
  @RequirePermission('orders:read')
  get(
    @CurrentStore() store: StoreContext,
    @Param('orderId', UuidParam) orderId: string,
  ): Promise<OrderDetail> {
    return this.orders.get(store.id, orderId);
  }

  @Post(':orderId/refunds')
  @RequirePermission('orders:write')
  @ApiZodBody(refundInputSchema)
  refund(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('orderId', UuidParam) orderId: string,
    @Body(new ZodPipe(refundInputSchema)) body: z.output<typeof refundInputSchema>,
    @ReqMeta() meta: RequestMeta,
  ): Promise<OrderDetail> {
    return this.orders.refund(store, orderId, body, user, meta);
  }

  @Post(':orderId/fulfillments')
  @RequirePermission('orders:write')
  @ApiZodBody(fulfillInputSchema)
  fulfill(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('orderId', UuidParam) orderId: string,
    @Body(new ZodPipe(fulfillInputSchema)) body: z.output<typeof fulfillInputSchema>,
    @ReqMeta() meta: RequestMeta,
  ): Promise<OrderDetail> {
    return this.orders.fulfill(store, orderId, body, user, meta);
  }

  @Post(':orderId/cancel')
  @RequirePermission('orders:write')
  @ApiZodBody(cancelOrderInputSchema)
  cancel(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('orderId', UuidParam) orderId: string,
    @Body(new ZodPipe(cancelOrderInputSchema)) body: z.output<typeof cancelOrderInputSchema>,
    @ReqMeta() meta: RequestMeta,
  ): Promise<OrderDetail> {
    return this.orders.cancel(store, orderId, body, user, meta);
  }
}
