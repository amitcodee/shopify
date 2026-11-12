import { Body, Controller, Get, Headers, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import {
  type BillingOverview,
  type ChangePlanResult,
  changePlanInputSchema,
  confirmRazorpaySubscriptionInputSchema,
} from '@repo/contracts';
import type { Request } from 'express';
import type { IncomingHttpHeaders } from 'node:http';
import type { z } from 'zod';
import { Public } from '../auth/auth.guard.js';
import type { AuthUser, RequestMeta, StoreContext } from '../common/request.js';
import { CurrentStore, CurrentUser, ReqMeta } from '../common/request.js';
import { ApiZodBody, ZodPipe } from '../common/zod.js';
import {
  AllowBillingLocked,
  AllowSuspendedStore,
  RequirePermission,
  StoreAccessGuard,
} from '../tenancy/store-access.guard.js';
import { BillingService } from './billing.service.js';

@ApiTags('billing')
@ApiBearerAuth()
@UseGuards(StoreAccessGuard)
@AllowBillingLocked()
@Controller('admin/stores/:storeId/billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get()
  @AllowSuspendedStore()
  @RequirePermission('settings:read')
  overview(@CurrentStore() store: StoreContext): Promise<BillingOverview> {
    return this.billing.overview(store.id);
  }

  @Post('plan')
  @HttpCode(200)
  @RequirePermission('billing:manage')
  @ApiZodBody(changePlanInputSchema)
  changePlan(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(changePlanInputSchema)) body: z.output<typeof changePlanInputSchema>,
    @ReqMeta() meta: RequestMeta,
  ): Promise<ChangePlanResult> {
    return this.billing.changePlan(store, body.planId, user, meta);
  }

  /** Razorpay Checkout success callback (the mandate was authorised). */
  @Post('razorpay/confirm')
  @HttpCode(200)
  @RequirePermission('billing:manage')
  @ApiZodBody(confirmRazorpaySubscriptionInputSchema)
  confirmRazorpay(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(confirmRazorpaySubscriptionInputSchema))
    body: z.output<typeof confirmRazorpaySubscriptionInputSchema>,
    @ReqMeta() meta: RequestMeta,
  ): Promise<BillingOverview> {
    return this.billing.confirmRazorpay(store, body, user, meta);
  }

  /** Re-reads the subscription from the provider (e.g. after paying on the hosted page). */
  @Post('sync')
  @HttpCode(200)
  @RequirePermission('settings:read')
  async sync(@CurrentStore() store: StoreContext): Promise<BillingOverview> {
    await this.billing.syncRazorpay(store.id);
    await this.billing.refreshLock(store.id);
    return this.billing.overview(store.id);
  }

  @Post('cancel')
  @HttpCode(200)
  @RequirePermission('billing:manage')
  cancel(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @ReqMeta() meta: RequestMeta,
  ): Promise<BillingOverview> {
    return this.billing.cancel(store, user, meta);
  }
}

@ApiTags('webhooks')
@Public()
@SkipThrottle()
@Controller('webhooks/billing')
export class BillingWebhooksController {
  constructor(private readonly billing: BillingService) {}

  @Post()
  @HttpCode(200)
  @ApiExcludeEndpoint()
  receive(@Req() req: RawBodyRequest<Request>, @Headers() headers: IncomingHttpHeaders) {
    return this.billing.handleWebhook(req.rawBody, headers);
  }

  /** Razorpay Subscriptions webhook (add it in the Razorpay Dashboard with its secret). */
  @Post('razorpay')
  @HttpCode(200)
  @ApiExcludeEndpoint()
  receiveRazorpay(@Req() req: RawBodyRequest<Request>, @Headers() headers: IncomingHttpHeaders) {
    return this.billing.handleRazorpayWebhook(req.rawBody, headers);
  }
}
