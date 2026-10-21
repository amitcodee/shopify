import { Module } from '@nestjs/common';
import { BlogService } from './blog.service.js';
import { OnlineStoreController } from './online-store.controller.js';
import { OnlineStoreService } from './online-store.service.js';

@Module({
  controllers: [OnlineStoreController],
  providers: [OnlineStoreService, BlogService],
  exports: [OnlineStoreService, BlogService],
})
export class OnlineStoreModule {}
