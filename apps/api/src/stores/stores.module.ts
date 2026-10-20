import { Module } from '@nestjs/common';
import { StoreController, StoresController } from './stores.controller.js';
import { StoresService } from './stores.service.js';

@Module({
  controllers: [StoresController, StoreController],
  providers: [StoresService],
  exports: [StoresService],
})
export class StoresModule {}
