import {
  Controller,
  Get,
  Injectable,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  type AdminCustomer,
  type AdminCustomerDetail,
  type Paginated,
  productListQuerySchema,
} from '@repo/contracts';
import type { Prisma } from '@repo/db';
import { z } from 'zod';
import type { StoreContext } from '../common/request.js';
import { CurrentStore } from '../common/request.js';
import { UuidParam } from '../common/uuid-param.pipe.js';
import { ZodPipe } from '../common/zod.js';
import { TenantDb } from '../database/database.module.js';
import { toListItem } from '../orders/orders.service.js';
import { RequirePermission, StoreAccessGuard } from '../tenancy/store-access.guard.js';

const customerQuerySchema = productListQuerySchema.pick({ q: true, page: true, pageSize: true });
type CustomerQuery = z.output<typeof customerQuerySchema>;

const PAID = ['PAID', 'PARTIALLY_REFUNDED'] as const;

@Injectable()
export class AdminCustomersService {
  constructor(private readonly tenantDb: TenantDb) {}

  async list(storeId: string, query: CustomerQuery): Promise<Paginated<AdminCustomer>> {
    const where: Prisma.CustomerWhereInput = { storeId };
    if (query.q) {
      where.OR = [
        { email: { contains: query.q, mode: 'insensitive' } },
        { name: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    return this.tenantDb.run(storeId, async (tx) => {
      const [rows, total] = await Promise.all([
        tx.customer.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        tx.customer.count({ where }),
      ]);
      // Totals in the store currency (orders paid in other currencies are converted back).
      const ids = rows.map((r) => r.id);
      const stats = ids.length
        ? await tx.$queryRaw<{ customerId: string; orders: number; spent: number }[]>`
            SELECT "customerId", COUNT(*)::int AS orders,
                   COALESCE(ROUND(SUM(total / "exchangeRate")), 0)::int AS spent
            FROM "Order"
            WHERE "storeId" = ${storeId}::uuid AND "customerId" = ANY(${ids}::uuid[])
              AND "financialStatus" IN ('PAID', 'PARTIALLY_REFUNDED')
            GROUP BY "customerId"`
        : [];
      const byCustomer = new Map(stats.map((s) => [s.customerId, s]));
      return {
        items: rows.map((c) => ({
          id: c.id,
          email: c.email,
          name: c.name,
          hasAccount: c.passwordHash !== null,
          acceptsMarketing: c.acceptsMarketing,
          ordersCount: byCustomer.get(c.id)?.orders ?? 0,
          totalSpent: byCustomer.get(c.id)?.spent ?? 0,
          createdAt: c.createdAt.toISOString(),
        })),
        page: query.page,
        pageSize: query.pageSize,
        total,
      };
    });
  }

  async get(storeId: string, customerId: string): Promise<AdminCustomerDetail> {
    return this.tenantDb.run(storeId, async (tx) => {
      const customer = await tx.customer.findFirst({ where: { id: customerId, storeId } });
      if (!customer) throw new NotFoundException('Customer not found.');
      const orders = await tx.order.findMany({
        where: { storeId, customerId },
        include: { lines: true, customer: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      const paid = orders.filter((o) => (PAID as readonly string[]).includes(o.financialStatus));
      return {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        hasAccount: customer.passwordHash !== null,
        acceptsMarketing: customer.acceptsMarketing,
        ordersCount: paid.length,
        totalSpent: paid.reduce((s, o) => s + o.total, 0),
        createdAt: customer.createdAt.toISOString(),
        orders: orders.map(toListItem),
      };
    });
  }
}

@ApiTags('customers')
@ApiBearerAuth()
@UseGuards(StoreAccessGuard)
@Controller('admin/stores/:storeId/customers')
export class AdminCustomersController {
  constructor(private readonly customers: AdminCustomersService) {}

  @Get()
  @RequirePermission('customers:read')
  list(
    @CurrentStore() store: StoreContext,
    @Query(new ZodPipe(customerQuerySchema)) query: CustomerQuery,
  ): Promise<Paginated<AdminCustomer>> {
    return this.customers.list(store.id, query);
  }

  @Get(':customerId')
  @RequirePermission('customers:read')
  get(
    @CurrentStore() store: StoreContext,
    @Param('customerId', UuidParam) customerId: string,
  ): Promise<AdminCustomerDetail> {
    return this.customers.get(store.id, customerId);
  }
}
