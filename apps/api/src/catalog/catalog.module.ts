import { Module } from '@nestjs/common';
import { CollectionsController } from './collections.controller.js';
import { CollectionsService } from './collections.service.js';
import { InventoryController, LocationsController } from './inventory.controller.js';
import { InventoryService } from './inventory.service.js';
import { ProductCsvController, ProductCsvService } from './product-csv.js';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';

@Module({
  controllers: [
    ProductsController,
    InventoryController,
    LocationsController,
    CollectionsController,
    ProductCsvController,
  ],
  providers: [ProductsService, InventoryService, CollectionsService, ProductCsvService],
  exports: [ProductsService, InventoryService, CollectionsService],
})
export class CatalogModule {}
