import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  type Collection,
  collectionInputSchema,
  collectionProductsInputSchema,
} from '@repo/contracts';
import type { z } from 'zod';
import type { AuthUser, RequestMeta, StoreContext } from '../common/request.js';
import { CurrentStore, CurrentUser, ReqMeta } from '../common/request.js';
import { UuidParam } from '../common/uuid-param.pipe.js';
import { ApiZodBody, ZodPipe } from '../common/zod.js';
import { RequirePermission, StoreAccessGuard } from '../tenancy/store-access.guard.js';
import { CollectionsService } from './collections.service.js';

type CollectionBody = z.output<typeof collectionInputSchema>;

@ApiTags('collections')
@ApiBearerAuth()
@UseGuards(StoreAccessGuard)
@Controller('admin/stores/:storeId/collections')
export class CollectionsController {
  constructor(private readonly collections: CollectionsService) {}

  @Get()
  @RequirePermission('products:read')
  list(@CurrentStore() store: StoreContext): Promise<Collection[]> {
    return this.collections.list(store.id);
  }

  @Post()
  @RequirePermission('products:write')
  @ApiZodBody(collectionInputSchema)
  create(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(collectionInputSchema)) body: CollectionBody,
    @ReqMeta() meta: RequestMeta,
  ): Promise<Collection> {
    return this.collections.create(store.id, body, user, meta);
  }

  @Get(':collectionId')
  @RequirePermission('products:read')
  get(
    @CurrentStore() store: StoreContext,
    @Param('collectionId', UuidParam) id: string,
  ): Promise<Collection> {
    return this.collections.get(store.id, id);
  }

  @Put(':collectionId')
  @RequirePermission('products:write')
  @ApiZodBody(collectionInputSchema)
  update(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('collectionId', UuidParam) id: string,
    @Body(new ZodPipe(collectionInputSchema)) body: CollectionBody,
    @ReqMeta() meta: RequestMeta,
  ): Promise<Collection> {
    return this.collections.update(store.id, id, body, user, meta);
  }

  @Put(':collectionId/products')
  @RequirePermission('products:write')
  @ApiZodBody(collectionProductsInputSchema)
  setProducts(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('collectionId', UuidParam) id: string,
    @Body(new ZodPipe(collectionProductsInputSchema))
    body: z.output<typeof collectionProductsInputSchema>,
    @ReqMeta() meta: RequestMeta,
  ): Promise<Collection> {
    return this.collections.setProducts(store.id, id, body.productIds, user, meta);
  }

  @Delete(':collectionId')
  @HttpCode(204)
  @RequirePermission('products:write')
  remove(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('collectionId', UuidParam) id: string,
    @ReqMeta() meta: RequestMeta,
  ): Promise<void> {
    return this.collections.remove(store.id, id, user, meta);
  }
}
