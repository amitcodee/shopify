import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  Injectable,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  closeReturnInputSchema,
  declineReturnInputSchema,
  type Paginated,
  type Return as ReturnDto,
  type ReturnListQuery,
  returnListQuerySchema,
  returnRequestInputSchema,
  STOREFRONT_HEADERS,
} from '@repo/contracts';
import type { Prisma, ReturnLine, Return, TenantTx } from '@repo/db';
import type { Request } from 'express';
import type { z } from 'zod';
import { Public } from '../auth/auth.guard.js';
import type { AuthUser, RequestMeta, StoreContext } from '../common/request.js';
import { CurrentStore, CurrentUser, ReqMeta } from '../common/request.js';
import { UuidParam } from '../common/uuid-param.pipe.js';
import { ApiZodBody, ZodPipe } from '../common/zod.js';
import { CustomerAuthService } from '../customers/customer-auth.service.js';
import { TenantDb } from '../database/database.module.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { returnUpdateEmail } from '../outbox/templates.js';
import { CurrentShop, StorefrontGuard } from '../storefront/storefront.guard.js';
import type { ShopContext } from '../storefront/store-resolver.js';
import { RequirePermission, StoreAccessGuard } from '../tenancy/store-access.guard.js';
import { OrderLifecycle } from './order-lifecycle.service.js';
import { OrdersService } from './orders.service.js';
import {
  returnedQuantities,
  returnWindowOpen,
  suggestedRefund,
  toReturnDto,
} from './return-rules.js';

type RequestInput = z.output<typeof returnRequestInputSchema>;
type ReturnWithLines = Return & { lines: ReturnLine[] };
type OrderForReturn = Prisma.OrderGetPayload<{
  include: { lines: true; returns: { include: { lines: true } } };
}>;

const orderForReturn = {
  lines: true,
  returns: { include: { lines: true } },
} satisfies Prisma.OrderInclude;

@Injectable()
export class ReturnsService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly lifecycle: OrderLifecycle,
    private readonly orders: OrdersService,
    private readonly outbox: OutboxService,
    private readonly customers: CustomerAuthService,
  ) {}

  /** A signed-in customer asks to return items of their own order (within the window). */
  async request(shop: ShopContext, token: string | null, number: number, input: RequestInput) {
    const customer = await this.customers.requireCurrent(shop, token);
    return this.tenantDb.run(shop.id, async (tx) => {
      const order = await tx.order.findFirst({
        where: { storeId: shop.id, customerId: customer.id, number },
        include: orderForReturn,
      });
      if (!order) throw new NotFoundException('Order not found.');
      if (!returnWindowOpen(order)) {
        throw new ConflictException(
          'This order can no longer be returned online. Contact the store.',
        );
      }
      const created = await this.create(tx, shop.id, order, input, true);
      await this.lifecycle.event(
        tx,
        shop.id,
        order.id,
        'return_requested',
        `Return requested by the customer (${created.lines.length} item line(s)).`,
      );
      const store = await tx.store.findUniqueOrThrow({ where: { id: shop.id } });
      await this.outbox.enqueueEmail(
        tx,
        shop.id,
        returnUpdateEmail(store.contactEmail, {
          storeName: store.name,
          orderNumber: order.number,
          message: `${order.email} asked to return items from order #${order.number}. Review it in your admin.`,
        }),
      );
      return toReturnDto(created, order);
    });
  }

  /** Staff record a return (e.g. by phone or in store); it starts approved. */
  adminCreate(store: StoreContext, orderId: string, input: RequestInput, actor: AuthUser) {
    return this.tenantDb.run(store.id, async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, storeId: store.id },
        include: orderForReturn,
      });
      if (!order) throw new NotFoundException('Order not found.');
      if (order.financialStatus !== 'PAID' && order.financialStatus !== 'PARTIALLY_REFUNDED') {
        throw new ConflictException('Only paid orders can have returns.');
      }
      const created = await this.create(tx, store.id, order, input, false);
      await this.lifecycle.event(
        tx,
        store.id,
        order.id,
        'return_opened',
        'Return created by staff.',
        {
          actorUserId: actor.id,
        },
      );
      return toReturnDto(created, order);
    });
  }

  list(storeId: string, query: ReturnListQuery): Promise<Paginated<ReturnDto>> {
    return this.tenantDb.run(storeId, async (tx) => {
      const where: Prisma.ReturnWhereInput = {
        storeId,
        ...(query.status ? { status: query.status } : {}),
      };
      const [rows, total] = await Promise.all([
        tx.return.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          include: { lines: true, order: { include: { lines: true } } },
        }),
        tx.return.count({ where }),
      ]);
      return {
        items: rows.map((r) => toReturnDto(r, r.order)),
        page: query.page,
        pageSize: query.pageSize,
        total,
      };
    });
  }

  approve(store: StoreContext, id: string, actor: AuthUser) {
    return this.transition(store, id, actor, 'REQUESTED', 'OPEN', {}, (order) => ({
      event: 'Return approved.',
      email: `Your return for order #${order.number} is approved. Please send the items back; we refund them once they arrive.`,
    }));
  }

  decline(store: StoreContext, id: string, reason: string, actor: AuthUser) {
    return this.transition(
      store,
      id,
      actor,
      'REQUESTED',
      'DECLINED',
      { declineReason: reason },
      (order) => ({
        event: `Return declined: ${reason}`,
        email: `We couldn't accept your return for order #${order.number}: ${reason}`,
      }),
    );
  }

  /**
   * Items received: refunds them (default: their value plus tax, through the order's normal
   * refund path, restocking if asked) and closes the return.
   */
  async close(
    store: StoreContext,
    id: string,
    input: z.output<typeof closeReturnInputSchema>,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<ReturnDto> {
    const { ret, order } = await this.tenantDb.run(store.id, async (tx) => {
      const ret = await this.find(tx, store.id, id);
      if (ret.status !== 'OPEN')
        throw new ConflictException('Only approved returns can be closed.');
      const order = await tx.order.findUniqueOrThrow({
        where: { id: ret.orderId },
        include: orderForReturn,
      });
      return { ret, order };
    });
    const amount = input.amount ?? suggestedRefund(order, order.lines, ret.lines);
    let refundId: string | null = null;
    if (amount > 0) {
      const detail = await this.orders.refund(
        store,
        order.id,
        {
          amount,
          reason: 'Return',
          restock: input.restock
            ? ret.lines.map((l) => ({ lineId: l.orderLineId, quantity: l.quantity }))
            : [],
        },
        actor,
        meta,
      );
      const last = detail.refunds.at(-1);
      if (!last || last.status === 'FAILED') {
        throw new ConflictException(
          'The refund failed at the payment provider; the return stays open.',
        );
      }
      refundId = last.id;
    } else if (input.restock) {
      await this.tenantDb.run(store.id, (tx) =>
        this.lifecycle.restock(
          tx,
          store.id,
          order.lines,
          new Map(ret.lines.map((l) => [l.orderLineId, l.quantity])),
          'RETURN',
          actor.id,
          order.id,
        ),
      );
    }
    return this.tenantDb.run(store.id, async (tx) => {
      const closed = await tx.return.update({
        where: { id },
        data: { status: 'CLOSED', closedAt: new Date(), refundId },
        include: { lines: true },
      });
      await this.lifecycle.event(
        tx,
        store.id,
        order.id,
        'return_closed',
        'Return received and closed.',
        {
          actorUserId: actor.id,
        },
      );
      return toReturnDto(closed, order);
    });
  }

  private async create(
    tx: TenantTx,
    storeId: string,
    order: OrderForReturn,
    input: RequestInput,
    byCustomer: boolean,
  ): Promise<ReturnWithLines> {
    // Lock the order so two requests cannot both claim the same units.
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${order.id}::uuid FOR UPDATE`;
    const fresh = await tx.return.findMany({
      where: { orderId: order.id, storeId },
      include: { lines: true },
    });
    const returned = returnedQuantities(fresh);
    const lines = new Map(order.lines.map((l) => [l.id, l]));
    const seen = new Set<string>();
    for (const item of input.lines) {
      const line = lines.get(item.orderLineId);
      if (!line || seen.has(item.orderLineId)) throw new BadRequestException('Unknown order line.');
      seen.add(item.orderLineId);
      const left = line.quantity - (returned.get(line.id) ?? 0);
      if (item.quantity > left) {
        throw new BadRequestException(`At most ${left} of ${line.title} can be returned.`);
      }
    }
    return tx.return.create({
      data: {
        storeId,
        orderId: order.id,
        status: byCustomer ? 'REQUESTED' : 'OPEN',
        requestedByCustomer: byCustomer,
        customerNote: input.note ?? null,
        lines: {
          create: input.lines.map((l) => ({
            orderLineId: l.orderLineId,
            quantity: l.quantity,
            reason: l.reason,
          })),
        },
      },
      include: { lines: true },
    });
  }

  private async transition(
    store: StoreContext,
    id: string,
    actor: AuthUser,
    from: 'REQUESTED',
    to: 'OPEN' | 'DECLINED',
    data: { declineReason?: string },
    messages: (order: { number: number }) => { event: string; email: string },
  ): Promise<ReturnDto> {
    return this.tenantDb.run(store.id, async (tx) => {
      const ret = await this.find(tx, store.id, id);
      if (ret.status !== from) throw new ConflictException('This return was already handled.');
      const updated = await tx.return.update({
        where: { id },
        data: { status: to, ...data },
        include: { lines: true },
      });
      const order = await tx.order.findUniqueOrThrow({
        where: { id: ret.orderId },
        include: { lines: true },
      });
      const { event, email } = messages(order);
      await this.lifecycle.event(tx, store.id, order.id, `return_${to.toLowerCase()}`, event, {
        actorUserId: actor.id,
      });
      const shop = await tx.store.findUniqueOrThrow({ where: { id: store.id } });
      await this.outbox.enqueueEmail(
        tx,
        store.id,
        returnUpdateEmail(order.email, {
          storeName: shop.name,
          orderNumber: order.number,
          message: email,
        }),
      );
      return toReturnDto(updated, order);
    });
  }

  private async find(tx: TenantTx, storeId: string, id: string): Promise<ReturnWithLines> {
    const ret = await tx.return.findFirst({ where: { id, storeId }, include: { lines: true } });
    if (!ret) throw new NotFoundException('Return not found.');
    return ret;
  }
}

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(StoreAccessGuard)
@Controller('admin/stores/:storeId')
export class ReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Get('returns')
  @RequirePermission('orders:read')
  list(
    @CurrentStore() store: StoreContext,
    @Query(new ZodPipe(returnListQuerySchema)) query: ReturnListQuery,
  ): Promise<Paginated<ReturnDto>> {
    return this.returns.list(store.id, query);
  }

  @Post('orders/:orderId/returns')
  @RequirePermission('orders:write')
  @ApiZodBody(returnRequestInputSchema)
  create(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('orderId', UuidParam) orderId: string,
    @Body(new ZodPipe(returnRequestInputSchema)) body: RequestInput,
  ): Promise<ReturnDto> {
    return this.returns.adminCreate(store, orderId, body, user);
  }

  @Post('returns/:returnId/approve')
  @HttpCode(200)
  @RequirePermission('orders:write')
  approve(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('returnId', UuidParam) id: string,
  ): Promise<ReturnDto> {
    return this.returns.approve(store, id, user);
  }

  @Post('returns/:returnId/decline')
  @HttpCode(200)
  @RequirePermission('orders:write')
  @ApiZodBody(declineReturnInputSchema)
  decline(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('returnId', UuidParam) id: string,
    @Body(new ZodPipe(declineReturnInputSchema)) body: z.output<typeof declineReturnInputSchema>,
  ): Promise<ReturnDto> {
    return this.returns.decline(store, id, body.reason, user);
  }

  @Post('returns/:returnId/close')
  @HttpCode(200)
  @RequirePermission('orders:write')
  @ApiZodBody(closeReturnInputSchema)
  close(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('returnId', UuidParam) id: string,
    @Body(new ZodPipe(closeReturnInputSchema)) body: z.output<typeof closeReturnInputSchema>,
    @ReqMeta() meta: RequestMeta,
  ): Promise<ReturnDto> {
    return this.returns.close(store, id, body, user, meta);
  }
}

@ApiTags('storefront')
@Public()
@UseGuards(StorefrontGuard)
@Controller('storefront/customers/me/orders')
export class CustomerReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Post(':number/returns')
  @ApiZodBody(returnRequestInputSchema)
  request(
    @CurrentShop() shop: ShopContext,
    @Req() req: Request,
    @Param('number', ParseIntPipe) number: number,
    @Body(new ZodPipe(returnRequestInputSchema)) body: RequestInput,
  ): Promise<ReturnDto> {
    const token = req.headers[STOREFRONT_HEADERS.customer];
    return this.returns.request(shop, typeof token === 'string' ? token : null, number, body);
  }
}
