import { Module } from '@nestjs/common';
import { StorefrontModule } from '../storefront/storefront.module.js';
import { StoreClosureService } from './store-closure.service.js';
import { StoreController, StoresController } from './stores.controller.js';
import { StoresService } from './stores.service.js';

@Module({
  imports: [StorefrontModule],
  controllers: [StoresController, StoreController],
  providers: [StoresService, StoreClosureService],
  exports: [StoresService, StoreClosureService],
})
export class StoresModule {}
