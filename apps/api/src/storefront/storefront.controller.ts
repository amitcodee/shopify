import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import {
  addToCartInputSchema,
  type Cart,
  type CreatedCart,
  type Policy,
  type PolicyKind,
  policyKindSchema,
  type ProductCardPage,
  type Shop,
  STOREFRONT_HEADERS,
  type StorefrontCollection,
  type StorefrontPage,
  type StorefrontSitemap,
  type StorefrontProduct,
  type StorefrontProductQuery,
  storefrontProductQuerySchema,
  updateCartLineInputSchema,
} from '@repo/contracts';
import type { z } from 'zod';
import { Public } from '../auth/auth.guard.js';
import { UuidParam } from '../common/uuid-param.pipe.js';
import { ApiZodBody, ZodPipe } from '../common/zod.js';
import { OnlineStoreService } from '../online-store/online-store.service.js';
import { CartService } from './cart.service.js';
import { StorefrontCatalogService } from './storefront-catalog.service.js';
import { CartToken, CurrentShop, StorefrontGuard } from './storefront.guard.js';
import type { ShopContext } from './store-resolver.js';

@ApiTags('storefront')
@ApiHeader({ name: STOREFRONT_HEADERS.host, required: true })
@ApiHeader({ name: STOREFRONT_HEADERS.timestamp, required: true })
@ApiHeader({ name: STOREFRONT_HEADERS.signature, required: true })
@Public()
@UseGuards(StorefrontGuard)
@Controller('storefront')
export class StorefrontController {
  constructor(
    private readonly catalog: StorefrontCatalogService,
    private readonly carts: CartService,
    private readonly onlineStore: OnlineStoreService,
  ) {}

  @Get('shop')
  shop(@CurrentShop() shop: ShopContext): Promise<Shop> {
    return this.catalog.shop(shop);
  }

  @Get('sitemap')
  sitemap(@CurrentShop() shop: ShopContext): Promise<StorefrontSitemap> {
    return this.catalog.sitemap(shop);
  }

  @Get('products')
  products(
    @CurrentShop() shop: ShopContext,
    @Query(new ZodPipe(storefrontProductQuerySchema)) query: StorefrontProductQuery,
  ): Promise<ProductCardPage> {
    return this.catalog.listProducts(shop, query);
  }

  @Get('products/:handle')
  product(
    @CurrentShop() shop: ShopContext,
    @Param('handle') handle: string,
  ): Promise<StorefrontProduct> {
    return this.catalog.getProduct(shop, handle.slice(0, 120));
  }

  @Get('pages/:handle')
  page(@CurrentShop() shop: ShopContext, @Param('handle') handle: string): Promise<StorefrontPage> {
    return this.onlineStore.storefrontPage(shop.id, handle.slice(0, 120));
  }

  @Get('policies/:kind')
  policy(
    @CurrentShop() shop: ShopContext,
    @Param('kind', new ZodPipe(policyKindSchema)) kind: PolicyKind,
  ): Promise<Policy> {
    return this.onlineStore.storefrontPolicy(shop.id, kind);
  }

  @Get('collections')
  collections(@CurrentShop() shop: ShopContext): Promise<StorefrontCollection[]> {
    return this.catalog.collections(shop);
  }

  @Get('collections/:handle')
  collection(
    @CurrentShop() shop: ShopContext,
    @Param('handle') handle: string,
  ): Promise<StorefrontCollection> {
    return this.catalog.collection(shop, handle.slice(0, 120));
  }

  @Post('cart')
  createCart(@CurrentShop() shop: ShopContext): Promise<CreatedCart> {
    return this.carts.create(shop);
  }

  @Get('cart')
  @ApiHeader({ name: STOREFRONT_HEADERS.cart, required: true })
  cart(@CurrentShop() shop: ShopContext, @CartToken() token: string | null): Promise<Cart> {
    return this.carts.get(shop, token);
  }

  @Post('cart/lines')
  @ApiZodBody(addToCartInputSchema)
  addLine(
    @CurrentShop() shop: ShopContext,
    @CartToken() token: string | null,
    @Body(new ZodPipe(addToCartInputSchema)) body: z.output<typeof addToCartInputSchema>,
  ): Promise<Cart> {
    return this.carts.addLine(shop, token, body.variantId, body.quantity);
  }

  @Patch('cart/lines/:lineId')
  @ApiZodBody(updateCartLineInputSchema)
  updateLine(
    @CurrentShop() shop: ShopContext,
    @CartToken() token: string | null,
    @Param('lineId', UuidParam) lineId: string,
    @Body(new ZodPipe(updateCartLineInputSchema)) body: z.output<typeof updateCartLineInputSchema>,
  ): Promise<Cart> {
    return this.carts.updateLine(shop, token, lineId, body.quantity);
  }

  @Delete('cart/lines/:lineId')
  removeLine(
    @CurrentShop() shop: ShopContext,
    @CartToken() token: string | null,
    @Param('lineId', UuidParam) lineId: string,
  ): Promise<Cart> {
    return this.carts.removeLine(shop, token, lineId);
  }
}
