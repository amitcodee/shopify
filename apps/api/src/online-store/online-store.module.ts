import { Module } from '@nestjs/common';
import { OnlineStoreController } from './online-store.controller.js';
import { OnlineStoreService } from './online-store.service.js';

@Module({
  controllers: [OnlineStoreController],
  providers: [OnlineStoreService],
  exports: [OnlineStoreService],
})
export class OnlineStoreModule {}
