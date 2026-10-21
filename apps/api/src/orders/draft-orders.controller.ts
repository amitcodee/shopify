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
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type CheckoutResult,
  type DraftOrder,
  draftOrderInputSchema,
  type DraftOrderListItem,
  type DraftOrderListQuery,
  draftOrderListQuerySchema,
  type Paginated,
  sendInvoiceInputSchema,
  type StorefrontInvoice,
} from '@repo/contracts';
import type { Request } from 'express';
import type { z } from 'zod';
import { Public } from '../auth/auth.guard.js';
import { signedHost } from '../checkout/checkout.controller.js';
import type { AuthUser, RequestMeta, StoreContext } from '../common/request.js';
import { CurrentStore, CurrentUser, ReqMeta } from '../common/request.js';
import { UuidParam } from '../common/uuid-param.pipe.js';
import { ApiZodBody, ZodPipe } from '../common/zod.js';
import { CurrentShop, StorefrontGuard } from '../storefront/storefront.guard.js';
import type { ShopContext } from '../storefront/store-resolver.js';
import { RequirePermission, StoreAccessGuard } from '../tenancy/store-access.guard.js';
import { DraftOrdersService } from './draft-orders.service.js';

type DraftBody = z.output<typeof draftOrderInputSchema>;

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(StoreAccessGuard)
@Controller('admin/stores/:storeId/draft-orders')
export class DraftOrdersController {
  constructor(private readonly drafts: DraftOrdersService) {}

  @Get()
  @RequirePermission('orders:read')
  list(
    @CurrentStore() store: StoreContext,
    @Query(new ZodPipe(draftOrderListQuerySchema)) query: DraftOrderListQuery,
  ): Promise<Paginated<DraftOrderListItem>> {
    return this.drafts.list(store.id, query);
  }

  @Post()
  @RequirePermission('orders:write')
  @ApiZodBody(draftOrderInputSchema)
  create(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(draftOrderInputSchema)) body: DraftBody,
    @ReqMeta() meta: RequestMeta,
  ): Promise<DraftOrder> {
    return this.drafts.create(store.id, body, user, meta);
  }

  @Get(':draftId')
  @RequirePermission('orders:read')
  get(
    @CurrentStore() store: StoreContext,
    @Param('draftId', UuidParam) id: string,
  ): Promise<DraftOrder> {
    return this.drafts.get(store.id, id);
  }

  @Put(':draftId')
  @RequirePermission('orders:write')
  @ApiZodBody(draftOrderInputSchema)
  update(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('draftId', UuidParam) id: string,
    @Body(new ZodPipe(draftOrderInputSchema)) body: DraftBody,
    @ReqMeta() meta: RequestMeta,
  ): Promise<DraftOrder> {
    return this.drafts.update(store.id, id, body, user, meta);
  }

  @Delete(':draftId')
  @HttpCode(204)
  @RequirePermission('orders:write')
  remove(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('draftId', UuidParam) id: string,
    @ReqMeta() meta: RequestMeta,
  ): Promise<void> {
    return this.drafts.remove(store.id, id, user, meta);
  }

  @Post(':draftId/send-invoice')
  @HttpCode(200)
  @RequirePermission('orders:write')
  @ApiZodBody(sendInvoiceInputSchema)
  sendInvoice(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('draftId', UuidParam) id: string,
    @Body(new ZodPipe(sendInvoiceInputSchema)) body: z.output<typeof sendInvoiceInputSchema>,
    @ReqMeta() meta: RequestMeta,
  ): Promise<DraftOrder> {
    return this.drafts.sendInvoice(store.id, id, body.message, user, meta);
  }

  /** Creates the order as paid (payment collected outside the platform). */
  @Post(':draftId/complete')
  @HttpCode(200)
  @RequirePermission('orders:write')
  complete(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('draftId', UuidParam) id: string,
    @ReqMeta() meta: RequestMeta,
  ): Promise<DraftOrder> {
    return this.drafts.complete(store.id, id, user, meta);
  }
}

@ApiTags('storefront')
@Public()
@UseGuards(StorefrontGuard)
@Controller('storefront/invoices')
export class InvoicesController {
  constructor(private readonly drafts: DraftOrdersService) {}

  @Get(':token')
  invoice(
    @CurrentShop() shop: ShopContext,
    @Param('token') token: string,
  ): Promise<StorefrontInvoice> {
    return this.drafts.invoice(shop, token.slice(0, 200));
  }

  @Post(':token/pay')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  pay(
    @CurrentShop() shop: ShopContext,
    @Req() req: Request,
    @Param('token') token: string,
  ): Promise<CheckoutResult> {
    return this.drafts.payInvoice(shop, signedHost(req), token.slice(0, 200));
  }
}
