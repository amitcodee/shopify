import type { IncomingHttpHeaders } from 'node:http';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import {
  connectAccountInputSchema,
  type PaymentsOverview,
  type ProviderLink,
  sandboxOnboardingInputSchema,
} from '@repo/contracts';
import type { Request } from 'express';
import type { z } from 'zod';
import { Public } from '../auth/auth.guard.js';
import type { AuthUser, RequestMeta, StoreContext } from '../common/request.js';
import { CurrentStore, CurrentUser, ReqMeta } from '../common/request.js';
import { ApiZodBody, ZodPipe } from '../common/zod.js';
import { TenantDb } from '../database/database.module.js';
import { RequirePermission, StoreAccessGuard } from '../tenancy/store-access.guard.js';
import { ACTIVE_CONNECT_PROVIDER, type ConnectProvider } from './connect-provider.js';
import { ConnectWebhooksService } from './connect-webhooks.service.js';
import { MockConnectProvider } from './mock-connect.provider.js';
import { MOCK_SIGNATURE_HEADER } from './mock-payment.provider.js';
import { PaymentAccountsService } from './payment-accounts.service.js';

/** Store payments: payout account onboarding, status, sales summary and payouts. */
@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(StoreAccessGuard)
@Controller('admin/stores/:storeId/payments')
export class PaymentAccountsController {
  constructor(
    private readonly accounts: PaymentAccountsService,
    private readonly webhooks: ConnectWebhooksService,
    private readonly tenantDb: TenantDb,
    @Inject(ACTIVE_CONNECT_PROVIDER) private readonly provider: ConnectProvider,
  ) {}

  @Get()
  @RequirePermission('settings:read')
  overview(@CurrentStore() store: StoreContext): Promise<PaymentsOverview> {
    return this.accounts.overview(store.id);
  }

  /** Payouts go to the owner's bank account: only billing managers (owners) can set them up. */
  @Post('account')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @RequirePermission('billing:manage')
  @ApiZodBody(connectAccountInputSchema)
  connect(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(connectAccountInputSchema)) body: z.output<typeof connectAccountInputSchema>,
    @ReqMeta() meta: RequestMeta,
  ): Promise<ProviderLink> {
    return this.accounts.connect(store, body.country, user, meta);
  }

  @Post('account/onboarding-link')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @RequirePermission('billing:manage')
  onboardingLink(@CurrentStore() store: StoreContext): Promise<ProviderLink> {
    return this.accounts.onboardingLink(store.id);
  }

  @Post('account/dashboard-link')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @RequirePermission('billing:manage')
  dashboardLink(@CurrentStore() store: StoreContext): Promise<ProviderLink> {
    return this.accounts.dashboardLink(store.id);
  }

  @Post('account/refresh')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @RequirePermission('settings:read')
  refresh(@CurrentStore() store: StoreContext): Promise<PaymentsOverview> {
    return this.accounts.refresh(store.id);
  }

  /** Sandbox only: simulates the provider finishing (or restricting) onboarding. */
  @Post('sandbox-onboarding')
  @HttpCode(200)
  @RequirePermission('billing:manage')
  @ApiZodBody(sandboxOnboardingInputSchema)
  async sandboxOnboarding(
    @CurrentStore() store: StoreContext,
    @Body(new ZodPipe(sandboxOnboardingInputSchema))
    body: z.output<typeof sandboxOnboardingInputSchema>,
  ): Promise<PaymentsOverview> {
    if (!(this.provider instanceof MockConnectProvider)) throw new NotFoundException();
    const account = await this.tenantDb.run(store.id, (tx) =>
      tx.paymentAccount.findUnique({ where: { storeId: store.id } }),
    );
    if (!account || account.provider !== 'mock' || account.status === 'DISCONNECTED') {
      throw new NotFoundException('Set up payments first.');
    }
    const hook = this.provider.buildAccountWebhook(
      account.accountId,
      body.outcome,
      account.country,
    );
    await this.webhooks.handle('mock', hook.body, { [MOCK_SIGNATURE_HEADER]: hook.signature });
    return this.accounts.overview(store.id);
  }
}

@ApiTags('webhooks')
@Public()
@SkipThrottle()
@Controller('webhooks/connect')
export class ConnectWebhooksController {
  constructor(private readonly webhooks: ConnectWebhooksService) {}

  @Post(':provider')
  @HttpCode(200)
  @ApiExcludeEndpoint()
  receive(
    @Param('provider') provider: string,
    @Req() req: RawBodyRequest<Request>,
    @Headers() headers: IncomingHttpHeaders,
  ) {
    return this.webhooks.handle(provider, req.rawBody, headers);
  }
}
