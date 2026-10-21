import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type AbandonedCheckout,
  type CreatedCart,
  type Paginated,
  type PaginationQuery,
  paginationQuerySchema,
  recoverCartInputSchema,
} from '@repo/contracts';
import type { z } from 'zod';
import { Public } from '../auth/auth.guard.js';
import { CurrentStore, type StoreContext } from '../common/request.js';
import { ApiZodBody, ZodPipe } from '../common/zod.js';
import { CurrentShop, StorefrontGuard } from '../storefront/storefront.guard.js';
import type { ShopContext } from '../storefront/store-resolver.js';
import { RequirePermission, StoreAccessGuard } from '../tenancy/store-access.guard.js';
import { CheckoutRecoveryService } from './checkout-recovery.service.js';

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(StoreAccessGuard)
@Controller('admin/stores/:storeId/abandoned-checkouts')
export class AbandonedCheckoutsController {
  constructor(private readonly recovery: CheckoutRecoveryService) {}

  @Get()
  @RequirePermission('orders:read')
  list(
    @CurrentStore() store: StoreContext,
    @Query(new ZodPipe(paginationQuerySchema)) query: PaginationQuery,
  ): Promise<Paginated<AbandonedCheckout>> {
    return this.recovery.list(store.id, query);
  }
}

@ApiTags('storefront')
@Public()
@UseGuards(StorefrontGuard)
@Controller('storefront')
export class CartRecoveryController {
  constructor(private readonly recovery: CheckoutRecoveryService) {}

  /** Opens the link from an abandoned-checkout email: a fresh cart with the same items. */
  @Post('cart/recover')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiZodBody(recoverCartInputSchema)
  recover(
    @CurrentShop() shop: ShopContext,
    @Body(new ZodPipe(recoverCartInputSchema)) body: z.output<typeof recoverCartInputSchema>,
  ): Promise<CreatedCart> {
    return this.recovery.recoverCart(shop, body.token);
  }
}
