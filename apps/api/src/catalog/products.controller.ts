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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import {
  type Paginated,
  type Product,
  type ProductInputParsed,
  productInputSchema,
  type ProductListItem,
  type ProductListQuery,
  productListQuerySchema,
  updateImageInputSchema,
} from '@repo/contracts';
import type { z } from 'zod';
import type { AuthUser, RequestMeta, StoreContext } from '../common/request.js';
import { CurrentStore, CurrentUser, ReqMeta } from '../common/request.js';
import { UuidParam } from '../common/uuid-param.pipe.js';
import { ApiZodBody, ZodPipe } from '../common/zod.js';
import { MAX_UPLOAD_BYTES } from '../storage/image-processor.js';
import { RequirePermission, StoreAccessGuard } from '../tenancy/store-access.guard.js';
import { ProductsService } from './products.service.js';

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

  @Post(':productId/images')
  @RequirePermission('products:write')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 5 } }),
  )
  addImage(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('productId', UuidParam) productId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: { alt?: unknown },
    @ReqMeta() meta: RequestMeta,
  ): Promise<Product> {
    if (!file) throw new BadRequestException('Attach an image in the "file" field.');
    const alt = typeof body.alt === 'string' ? body.alt : '';
    return this.products.addImage(store, productId, file.buffer, alt, user, meta);
  }

  @Patch(':productId/images/:imageId')
  @RequirePermission('products:write')
  @ApiZodBody(updateImageInputSchema)
  updateImage(
    @CurrentStore() store: StoreContext,
    @Param('productId', UuidParam) productId: string,
    @Param('imageId', UuidParam) imageId: string,
    @Body(new ZodPipe(updateImageInputSchema)) body: z.output<typeof updateImageInputSchema>,
  ): Promise<Product> {
    return this.products.updateImage(store, productId, imageId, body);
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
}
