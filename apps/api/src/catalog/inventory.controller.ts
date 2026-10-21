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
  inventoryAdjustInputSchema,
  type InventoryAdjustment,
  type InventoryItem,
  inventoryTransferInputSchema,
  type Location,
  locationInputSchema,
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

  @Post(':variantId/transfer')
  @RequirePermission('products:write')
  @ApiZodBody(inventoryTransferInputSchema)
  transfer(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('variantId', UuidParam) variantId: string,
    @Body(new ZodPipe(inventoryTransferInputSchema))
    body: z.output<typeof inventoryTransferInputSchema>,
    @ReqMeta() meta: RequestMeta,
  ): Promise<InventoryItem> {
    return this.inventory.transfer(store.id, variantId, body, user, meta);
  }
}

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(StoreAccessGuard)
@Controller('admin/stores/:storeId/locations')
export class LocationsController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  @RequirePermission('products:read')
  list(@CurrentStore() store: StoreContext): Promise<Location[]> {
    return this.inventory.listLocations(store.id);
  }

  @Post()
  @RequirePermission('settings:write')
  @ApiZodBody(locationInputSchema)
  create(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(locationInputSchema)) body: z.output<typeof locationInputSchema>,
    @ReqMeta() meta: RequestMeta,
  ): Promise<Location[]> {
    return this.inventory.saveLocation(store.id, null, body, user, meta);
  }

  @Put(':locationId')
  @RequirePermission('settings:write')
  @ApiZodBody(locationInputSchema)
  update(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('locationId', UuidParam) id: string,
    @Body(new ZodPipe(locationInputSchema)) body: z.output<typeof locationInputSchema>,
    @ReqMeta() meta: RequestMeta,
  ): Promise<Location[]> {
    return this.inventory.saveLocation(store.id, id, body, user, meta);
  }

  @Delete(':locationId')
  @HttpCode(204)
  @RequirePermission('settings:write')
  remove(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('locationId', UuidParam) id: string,
    @ReqMeta() meta: RequestMeta,
  ): Promise<void> {
    return this.inventory.removeLocation(store.id, id, user, meta);
  }
}
