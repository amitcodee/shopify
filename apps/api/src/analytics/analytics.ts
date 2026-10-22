import { Controller, Get, Injectable, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type Analytics, analyticsQuerySchema } from '@repo/contracts';
import type { z } from 'zod';
import type { StoreContext } from '../common/request.js';
import { CurrentStore } from '../common/request.js';
import { ZodPipe } from '../common/zod.js';
import { TenantDb } from '../database/database.module.js';
import { RequirePermission, StoreAccessGuard } from '../tenancy/store-access.guard.js';

@Injectable()
export class AnalyticsService {
  constructor(private readonly tenantDb: TenantDb) {}

  /** Sales metrics from paid orders (by payment date, UTC days). */
  async summary(store: StoreContext, days: number): Promise<Analytics> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.tenantDb.run(store.id, async (tx) => {
      const [totals] = await tx.$queryRaw<{ gross: number; orders: number }[]>`
        SELECT COALESCE(ROUND(SUM(total / "exchangeRate")), 0)::int AS gross, COUNT(*)::int AS orders
        FROM "Order"
        WHERE "storeId" = ${store.id}::uuid AND "paidAt" >= ${since}`;
      const [refunds] = await tx.$queryRaw<{ refunded: number }[]>`
        SELECT COALESCE(ROUND(SUM(r.amount / o."exchangeRate")), 0)::int AS refunded
        FROM "Refund" r JOIN "Order" o ON o.id = r."orderId"
        WHERE r."storeId" = ${store.id}::uuid AND r.status = 'SUCCEEDED' AND r."createdAt" >= ${since}`;
      const daily = await tx.$queryRaw<{ date: string; sales: number; orders: number }[]>`
        SELECT to_char(d.day, 'YYYY-MM-DD') AS date,
               COALESCE(ROUND(SUM(o.total / o."exchangeRate")), 0)::int AS sales,
               COUNT(o.id)::int AS orders
        FROM generate_series(date_trunc('day', ${since}::timestamp), date_trunc('day', now()), interval '1 day') AS d(day)
        LEFT JOIN "Order" o ON o."storeId" = ${store.id}::uuid
          AND o."paidAt" >= d.day AND o."paidAt" < d.day + interval '1 day'
        GROUP BY d.day ORDER BY d.day`;
      const topProducts = await tx.$queryRaw<
        { title: string; quantity: number; revenue: number }[]
      >`
        SELECT l.title, SUM(l.quantity)::int AS quantity, ROUND(SUM((l."unitPrice" * l.quantity - l."discountTotal") / o."exchangeRate"))::int AS revenue
        FROM "OrderLine" l JOIN "Order" o ON o.id = l."orderId"
        WHERE o."storeId" = ${store.id}::uuid AND o."paidAt" >= ${since}
        GROUP BY l.title ORDER BY revenue DESC LIMIT 5`;

      const gross = totals?.gross ?? 0;
      const orderCount = totals?.orders ?? 0;
      const refunded = refunds?.refunded ?? 0;
      return {
        currency: store.currency,
        rangeDays: days,
        grossSales: gross,
        refunded,
        netSales: gross - refunded,
        orderCount,
        averageOrderValue: orderCount ? Math.round(gross / orderCount) : 0,
        daily,
        topProducts,
      };
    });
  }
}

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(StoreAccessGuard)
@Controller('admin/stores/:storeId/analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get()
  @RequirePermission('analytics:read')
  summary(
    @CurrentStore() store: StoreContext,
    @Query(new ZodPipe(analyticsQuerySchema)) query: z.output<typeof analyticsQuerySchema>,
  ): Promise<Analytics> {
    return this.analytics.summary(store, query.days);
  }
}
