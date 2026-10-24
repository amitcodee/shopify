import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import {
  importImageInputSchema,
  type Paginated,
  type Product,
  productBulkInputSchema,
  type ProductBulkResult,
  type ProductFacets,
  type ProductInputParsed,
  productInputSchema,
  type ProductListItem,
  type ProductListQuery,
  productListQuerySchema,
  reorderImagesInputSchema,
  updateImageInputSchema,
  updateVariantImageInputSchema,
} from '@repo/contracts';
import type { z } from 'zod';
import type { AuthUser, RequestMeta, StoreContext } from '../common/request.js';
import { CurrentStore, CurrentUser, ReqMeta } from '../common/request.js';
import { UuidParam } from '../common/uuid-param.pipe.js';
import { ApiZodBody, ZodPipe } from '../common/zod.js';
import { MAX_IMAGE_BYTES } from '../storage/image-processor.js';
import { RequirePermission, StoreAccessGuard } from '../tenancy/store-access.guard.js';
import { ProductsService } from './products.service.js';

/** Most images one upload request may carry. */
const MAX_FILES_PER_UPLOAD = 10;

@ApiTags('products')
@ApiBearerAuth()
@UseGuards(StoreAccessGuard)
@Controller('admin/stores/:storeId/products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @RequirePermission('products:read')
  list(
    @CurrentStore() store: StoreContext,
    @Query(new ZodPipe(productListQuerySchema)) query: ProductListQuery,
  ): Promise<Paginated<ProductListItem>> {
    return this.products.list(store.id, query);
  }

  /** Declared before `:productId` so "facets" is not taken for an id. */
  @Get('facets')
  @RequirePermission('products:read')
  facets(@CurrentStore() store: StoreContext): Promise<ProductFacets> {
    return this.products.facets(store.id);
  }

  @Post()
  @RequirePermission('products:write')
  @ApiZodBody(productInputSchema)
  create(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(productInputSchema)) body: ProductInputParsed,
    @ReqMeta() meta: RequestMeta,
  ): Promise<Product> {
    return this.products.create(store, body, user, meta);
  }

  @Post('bulk')
  @HttpCode(200)
  @RequirePermission('products:write')
  @ApiZodBody(productBulkInputSchema)
  bulk(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(productBulkInputSchema)) body: z.output<typeof productBulkInputSchema>,
    @ReqMeta() meta: RequestMeta,
  ): Promise<ProductBulkResult> {
    return this.products.bulk(store, body, user, meta);
  }

  @Get(':productId')
  @RequirePermission('products:read')
  get(
    @CurrentStore() store: StoreContext,
    @Param('productId', UuidParam) productId: string,
  ): Promise<Product> {
    return this.products.get(store.id, productId);
  }

  @Put(':productId')
  @RequirePermission('products:write')
  @ApiZodBody(productInputSchema)
  update(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('productId', UuidParam) productId: string,
    @Body(new ZodPipe(productInputSchema)) body: ProductInputParsed,
    @ReqMeta() meta: RequestMeta,
  ): Promise<Product> {
    return this.products.update(store, productId, body, user, meta);
  }

  @Delete(':productId')
  @HttpCode(204)
  @RequirePermission('products:write')
  remove(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('productId', UuidParam) productId: string,
    @ReqMeta() meta: RequestMeta,
  ): Promise<void> {
    return this.products.remove(store, productId, user, meta);
  }

  /**
   * Multipart upload: one image in `file` (the original API) and/or up to 10 in `files`. An
   * optional `alt` field applies to every uploaded image. All-or-nothing.
   */
  @Post(':productId/images')
  @RequirePermission('products:write')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'file', maxCount: 1 },
        { name: 'files', maxCount: MAX_FILES_PER_UPLOAD },
      ],
      { limits: { fileSize: MAX_IMAGE_BYTES, files: MAX_FILES_PER_UPLOAD, fields: 5 } },
    ),
  )
  addImages(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('productId', UuidParam) productId: string,
    @UploadedFiles()
    uploads: { file?: Express.Multer.File[]; files?: Express.Multer.File[] } | undefined,
    @Body() body: { alt?: unknown },
    @ReqMeta() meta: RequestMeta,
  ): Promise<Product> {
    const files = [...(uploads?.file ?? []), ...(uploads?.files ?? [])];
    if (files.length === 0) {
      throw new BadRequestException('Attach images in the "files" (or "file") field.');
    }
    const alt = typeof body.alt === 'string' ? body.alt.trim().slice(0, 512) : '';
    return this.products.addImages(
      store,
      productId,
      files.map((f) => f.buffer),
      alt,
      user,
      meta,
    );
  }

  @Post(':productId/images/import')
  @RequirePermission('products:write')
  @ApiZodBody(importImageInputSchema)
  importImage(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('productId', UuidParam) productId: string,
    @Body(new ZodPipe(importImageInputSchema)) body: z.output<typeof importImageInputSchema>,
    @ReqMeta() meta: RequestMeta,
  ): Promise<Product> {
    return this.products.importImage(store, productId, body, user, meta);
  }

  @Put(':productId/images/order')
  @RequirePermission('products:write')
  @ApiZodBody(reorderImagesInputSchema)
  reorderImages(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('productId', UuidParam) productId: string,
    @Body(new ZodPipe(reorderImagesInputSchema)) body: z.output<typeof reorderImagesInputSchema>,
    @ReqMeta() meta: RequestMeta,
  ): Promise<Product> {
    return this.products.reorderImages(store, productId, body.imageIds, user, meta);
  }

  @Patch(':productId/images/:imageId')
  @RequirePermission('products:write')
  @ApiZodBody(updateImageInputSchema)
  updateImage(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('productId', UuidParam) productId: string,
    @Param('imageId', UuidParam) imageId: string,
    @Body(new ZodPipe(updateImageInputSchema)) body: z.output<typeof updateImageInputSchema>,
    @ReqMeta() meta: RequestMeta,
  ): Promise<Product> {
    return this.products.updateImage(store, productId, imageId, body, user, meta);
  }

  @Delete(':productId/images/:imageId')
  @RequirePermission('products:write')
  removeImage(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('productId', UuidParam) productId: string,
    @Param('imageId', UuidParam) imageId: string,
    @ReqMeta() meta: RequestMeta,
  ): Promise<Product> {
    return this.products.removeImage(store, productId, imageId, user, meta);
  }

  @Patch(':productId/variants/:variantId')
  @RequirePermission('products:write')
  @ApiZodBody(updateVariantImageInputSchema)
  updateVariant(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('productId', UuidParam) productId: string,
    @Param('variantId', UuidParam) variantId: string,
    @Body(new ZodPipe(updateVariantImageInputSchema))
    body: z.output<typeof updateVariantImageInputSchema>,
    @ReqMeta() meta: RequestMeta,
  ): Promise<Product> {
    return this.products.setVariantImage(store, productId, variantId, body.imageId, user, meta);
  }
}
