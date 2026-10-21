import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  type GiftCard,
  giftCardAdjustInputSchema,
  type GiftCardDetail,
  giftCardIssueInputSchema,
  type GiftCardListQuery,
  giftCardListQuerySchema,
  giftCardUpdateInputSchema,
  type IssuedGiftCard,
  type Paginated,
} from '@repo/contracts';
import type { z } from 'zod';
import type { AuthUser, RequestMeta, StoreContext } from '../common/request.js';
import { CurrentStore, CurrentUser, ReqMeta } from '../common/request.js';
import { UuidParam } from '../common/uuid-param.pipe.js';
import { ApiZodBody, ZodPipe } from '../common/zod.js';
import { RequirePermission, StoreAccessGuard } from '../tenancy/store-access.guard.js';
import { GiftCardsService } from './gift-cards.service.js';

/** Gift cards are money: reading and issuing them follows the orders permissions. */
@ApiTags('gift-cards')
@ApiBearerAuth()
@UseGuards(StoreAccessGuard)
@Controller('admin/stores/:storeId/gift-cards')
export class GiftCardsController {
  constructor(private readonly giftCards: GiftCardsService) {}

  @Get()
  @RequirePermission('orders:read')
  list(
    @CurrentStore() store: StoreContext,
    @Query(new ZodPipe(giftCardListQuerySchema)) query: GiftCardListQuery,
  ): Promise<Paginated<GiftCard>> {
    return this.giftCards.list(store.id, query);
  }

  @Post()
  @RequirePermission('orders:write')
  @ApiZodBody(giftCardIssueInputSchema)
  issue(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(giftCardIssueInputSchema)) body: z.output<typeof giftCardIssueInputSchema>,
    @ReqMeta() meta: RequestMeta,
  ): Promise<IssuedGiftCard> {
    return this.giftCards.issue(store.id, body, user, meta);
  }

  @Get(':giftCardId')
  @RequirePermission('orders:read')
  get(
    @CurrentStore() store: StoreContext,
    @Param('giftCardId', UuidParam) id: string,
  ): Promise<GiftCardDetail> {
    return this.giftCards.get(store.id, id);
  }

  @Patch(':giftCardId')
  @RequirePermission('orders:write')
  @ApiZodBody(giftCardUpdateInputSchema)
  update(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('giftCardId', UuidParam) id: string,
    @Body(new ZodPipe(giftCardUpdateInputSchema)) body: z.output<typeof giftCardUpdateInputSchema>,
    @ReqMeta() meta: RequestMeta,
  ): Promise<GiftCardDetail> {
    return this.giftCards.update(store.id, id, body, user, meta);
  }

  @Post(':giftCardId/adjustments')
  @RequirePermission('orders:write')
  @ApiZodBody(giftCardAdjustInputSchema)
  adjust(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('giftCardId', UuidParam) id: string,
    @Body(new ZodPipe(giftCardAdjustInputSchema)) body: z.output<typeof giftCardAdjustInputSchema>,
    @ReqMeta() meta: RequestMeta,
  ): Promise<GiftCardDetail> {
    return this.giftCards.adjust(store.id, id, body, user, meta);
  }
}
