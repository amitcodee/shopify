import { Module } from '@nestjs/common';
import { CartService } from './cart.service.js';
import { StorefrontCatalogService } from './storefront-catalog.service.js';
import { StorefrontController } from './storefront.controller.js';
import { StorefrontGuard } from './storefront.guard.js';
import { StoreResolver } from './store-resolver.js';
import { TlsCheckController } from './tls-check.controller.js';

@Module({
  controllers: [StorefrontController, TlsCheckController],
  providers: [StoreResolver, StorefrontGuard, StorefrontCatalogService, CartService],
  exports: [StoreResolver, StorefrontGuard, CartService, StorefrontCatalogService],
})
export class StorefrontModule {}
