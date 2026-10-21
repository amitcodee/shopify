import { Module } from '@nestjs/common';
import { OrdersCoreModule } from '../orders/orders-core.module.js';
import { GiftCardsController } from './gift-cards.controller.js';
import { GiftCardsService } from './gift-cards.service.js';

@Module({
  imports: [OrdersCoreModule],
  controllers: [GiftCardsController],
  providers: [GiftCardsService],
})
export class GiftCardsModule {}
