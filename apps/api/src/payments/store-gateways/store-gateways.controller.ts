import { randomBytes } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import {
  All,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeController, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import {
  type CodSettingsInput,
  codSettingsInputSchema,
  type SaveStoreGatewayInput,
  type SavedStoreGateway,
  saveStoreGatewayInputSchema,
  storeGatewayIdSchema,
  type StoreGatewayId,
  type StoreGatewaysOverview,
} from '@repo/contracts';
import { isUuid, type PrismaClient } from '@repo/db';
import type { Request, Response } from 'express';
import { Public } from '../../auth/auth.guard.js';
import type { AuthUser, RequestMeta, StoreContext } from '../../common/request.js';
import { CurrentStore, CurrentUser, ReqMeta } from '../../common/request.js';
import { ApiZodBody, ZodPipe } from '../../common/zod.js';
import { PLATFORM_DB } from '../../database/database.module.js';
import { RequirePermission, StoreAccessGuard } from '../../tenancy/store-access.guard.js';
import { InvalidWebhookError } from '../payment-provider.js';
import { PaymentWebhooksService } from '../payment-webhooks.service.js';
import { StoreGatewaysService } from './store-gateways.service.js';

function gatewayId(value: string): StoreGatewayId {
  const parsed = storeGatewayIdSchema.safeParse(value);
  if (!parsed.success) throw new NotFoundException();
  return parsed.data;
}

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(StoreAccessGuard)
@Controller('admin/stores/:storeId/store-gateways')
export class StoreGatewaysController {
  constructor(private readonly gateways: StoreGatewaysService) {}

  @Get()
  @RequirePermission('settings:read')
  overview(@CurrentStore() store: StoreContext): Promise<StoreGatewaysOverview> {
    return this.gateways.overview(store.id);
  }

  @Put('cod')
  @HttpCode(204)
  @RequirePermission('billing:manage')
  @ApiZodBody(codSettingsInputSchema)
  saveCod(
    @CurrentStore() store: StoreContext,
    @Body(new ZodPipe(codSettingsInputSchema)) body: CodSettingsInput,
    @CurrentUser() user: AuthUser,
    @ReqMeta() meta: RequestMeta,
  ): Promise<void> {
    return this.gateways.saveCod(store.id, body, user, meta);
  }

  @Put(':gateway')
  @RequirePermission('billing:manage')
  @ApiZodBody(saveStoreGatewayInputSchema)
  save(
    @CurrentStore() store: StoreContext,
    @Param('gateway') gateway: string,
    @Body(new ZodPipe(saveStoreGatewayInputSchema)) body: SaveStoreGatewayInput,
    @CurrentUser() user: AuthUser,
    @ReqMeta() meta: RequestMeta,
  ): Promise<SavedStoreGateway> {
    return this.gateways.save(store.id, gatewayId(gateway), body, user, meta);
  }

  @Post(':gateway/activate')
  @HttpCode(204)
  @RequirePermission('billing:manage')
  activate(
    @CurrentStore() store: StoreContext,
    @Param('gateway') gateway: string,
    @CurrentUser() user: AuthUser,
    @ReqMeta() meta: RequestMeta,
  ): Promise<void> {
    return this.gateways.activate(store.id, gatewayId(gateway), user, meta);
  }

  @Post(':gateway/deactivate')
  @HttpCode(204)
  @RequirePermission('billing:manage')
  deactivate(
    @CurrentStore() store: StoreContext,
    @Param('gateway') gateway: string,
    @CurrentUser() user: AuthUser,
    @ReqMeta() meta: RequestMeta,
  ): Promise<void> {
    return this.gateways.deactivate(store.id, gatewayId(gateway), user, meta);
  }

  @Delete(':gateway')
  @HttpCode(204)
  @RequirePermission('billing:manage')
  remove(
    @CurrentStore() store: StoreContext,
    @Param('gateway') gateway: string,
    @CurrentUser() user: AuthUser,
    @ReqMeta() meta: RequestMeta,
  ): Promise<void> {
    return this.gateways.remove(store.id, gatewayId(gateway), user, meta);
  }
}

/** Public endpoints the gateways and the shopper's browser reach. Every result is signed or re-read. */
@ApiExcludeController()
@Public()
@Controller()
export class StoreGatewayPublicController {
  constructor(
    private readonly gateways: StoreGatewaysService,
    private readonly webhooks: PaymentWebhooksService,
    @Inject(PLATFORM_DB) private readonly db: PrismaClient,
  ) {}

  @Post('webhooks/store-gateways/:storeId/:gateway')
  @SkipThrottle()
  @HttpCode(200)
  webhook(
    @Param('storeId') storeId: string,
    @Param('gateway') gateway: string,
    @Req() req: RawBodyRequest<Request>,
    @Headers() headers: IncomingHttpHeaders,
  ) {
    if (!isUuid(storeId)) throw new NotFoundException();
    return this.webhooks.handleStoreGateway(storeId, gatewayId(gateway), req.rawBody, headers);
  }

  /** Posts the shopper to gateways that take a browser form (PayU). */
  @Get('store-gateways/:storeId/:gateway/pay/:reference')
  async pay(
    @Param('storeId') storeId: string,
    @Param('gateway') gateway: string,
    @Param('reference') reference: string,
    @Res() res: Response,
  ): Promise<void> {
    if (!isUuid(storeId)) throw new NotFoundException();
    const adapter = await this.gateways.adapterFor(storeId, gatewayId(gateway));
    if (!adapter?.payForm) throw new NotFoundException();
    const payment = await this.db.payment.findFirst({
      where: {
        storeId,
        provider: { startsWith: `own_${gateway}` },
        providerRef: reference,
        status: 'PENDING',
      },
      select: {
        amount: true,
        currency: true,
        order: {
          select: { id: true, number: true, email: true, shippingAddress: true },
        },
      },
    });
    if (!payment) throw new NotFoundException();
    const address = payment.order.shippingAddress as { name?: string; phone?: string };
    const form = adapter.payForm({
      reference,
      amount: payment.amount,
      currency: payment.currency,
      orderId: payment.order.id,
      orderNumber: payment.order.number,
      email: payment.order.email,
      name: address.name ?? payment.order.email,
      phone: address.phone ?? '',
    });
    const nonce = randomBytes(16).toString('base64');
    const inputs = Object.entries(form.fields)
      .map(
        ([name, value]) =>
          `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`,
      )
      .join('');
    res
      .status(200)
      .setHeader('Cache-Control', 'no-store')
      .setHeader(
        'Content-Security-Policy',
        `default-src 'none'; script-src 'nonce-${nonce}'; form-action https:; base-uri 'none'`,
      )
      .type('html')
      .send(
        `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Continue to payment</title></head>` +
          `<body><form id="pay" method="post" action="${escapeHtml(form.action)}">${inputs}` +
          `<button type="submit">Continue to payment</button></form>` +
          `<script nonce="${nonce}">document.getElementById('pay').submit()</script></body></html>`,
      );
  }

  /** Where the gateway sends the shopper back; applies the signed result, then shows the order. */
  @All('store-gateways/:storeId/:gateway/return')
  async return(
    @Param('storeId') storeId: string,
    @Param('gateway') gateway: string,
    @Query() query: Record<string, string>,
    @Req() req: RawBodyRequest<Request>,
    @Res() res: Response,
  ): Promise<void> {
    if (!isUuid(storeId)) throw new NotFoundException();
    const id = gatewayId(gateway);
    const adapter = await this.gateways.adapterFor(storeId, id);
    if (!adapter?.completeReturn) throw new NotFoundException();
    let outcome;
    try {
      outcome = await adapter.completeReturn({ query, rawBody: req.rawBody });
    } catch (error) {
      if (error instanceof InvalidWebhookError) {
        res.status(400).type('text').send('This payment response could not be verified.');
        return;
      }
      throw error;
    }
    await this.webhooks.applyStoreGateway(storeId, id, outcome);
    const reference =
      outcome.kind === 'payment_succeeded' || outcome.kind === 'payment_failed'
        ? outcome.providerRef
        : (query.token ?? query.reference ?? '');
    const payment = await this.db.payment.findFirst({
      where: { storeId, provider: { startsWith: `own_${id}` }, providerRef: reference },
      select: { returnUrl: true },
    });
    if (!payment?.returnUrl) throw new NotFoundException();
    res.redirect(303, payment.returnUrl);
  }
}
