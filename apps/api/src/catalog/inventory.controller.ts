import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  inventoryAdjustInputSchema,
  type InventoryAdjustment,
  type InventoryItem,
  inventoryListQuerySchema,
  type Paginated,
} from '@repo/contracts';
import type { z } from 'zod';
import type { AuthUser, RequestMeta, StoreContext } from '../common/request.js';
import { CurrentStore, CurrentUser, ReqMeta } from '../common/request.js';
import { UuidParam } from '../common/uuid-param.pipe.js';
import { ApiZodBody, ZodPipe } from '../common/zod.js';
import { RequirePermission, StoreAccessGuard } from '../tenancy/store-access.guard.js';
import { InventoryService } from './inventory.service.js';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(StoreAccessGuard)
@Controller('admin/stores/:storeId/inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  @RequirePermission('products:read')
  list(
    @CurrentStore() store: StoreContext,
    @Query(new ZodPipe(inventoryListQuerySchema)) query: z.output<typeof inventoryListQuerySchema>,
  ): Promise<Paginated<InventoryItem>> {
    return this.inventory.list(store.id, query);
  }

  @Post(':variantId/adjust')
  @RequirePermission('products:write')
  @ApiZodBody(inventoryAdjustInputSchema)
  adjust(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('variantId', UuidParam) variantId: string,
    @Body(new ZodPipe(inventoryAdjustInputSchema))
    body: z.output<typeof inventoryAdjustInputSchema>,
    @ReqMeta() meta: RequestMeta,
  ): Promise<InventoryItem> {
    return this.inventory.adjust(store.id, variantId, body, user, meta);
  }

  @Get(':variantId/history')
  @RequirePermission('products:read')
  history(
    @CurrentStore() store: StoreContext,
    @Param('variantId', UuidParam) variantId: string,
  ): Promise<InventoryAdjustment[]> {
    return this.inventory.history(store.id, variantId);
  }
}
