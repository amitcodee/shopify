import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  type PaginationQuery,
  paginationQuerySchema,
  type Segment,
  type SegmentCondition,
  segmentConditionSchema,
  segmentInputSchema,
  type SegmentMembers,
  toCsv,
} from '@repo/contracts';
import { Prisma, type TenantTx } from '@repo/db';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser, RequestMeta, StoreContext } from '../common/request.js';
import { CurrentStore, CurrentUser, ReqMeta } from '../common/request.js';
import { UuidParam } from '../common/uuid-param.pipe.js';
import { ApiZodBody, ZodPipe } from '../common/zod.js';
import { TenantDb } from '../database/database.module.js';
import { RequirePermission, StoreAccessGuard } from '../tenancy/store-access.guard.js';

type SegmentInput = z.output<typeof segmentInputSchema>;

interface MemberRow {
  id: string;
  email: string;
  name: string | null;
  has_account: boolean;
  accepts_marketing: boolean;
  orders_count: number;
  total_spent: number;
  last_order_at: Date | null;
  created_at: Date;
}

const storedConditions = z.array(segmentConditionSchema).catch([]);
const DAY = 'make_interval(days => ';

/** Compiles one typed condition to SQL over the `stats` CTE. Values are always bound. */
function conditionSql(c: SegmentCondition): Prisma.Sql {
  switch (c.field) {
    case 'ordersCount':
      return c.op === 'eq'
        ? Prisma.sql`orders_count = ${c.value}`
        : c.op === 'gte'
          ? Prisma.sql`orders_count >= ${c.value}`
          : Prisma.sql`orders_count <= ${c.value}`;
    case 'totalSpent':
      return c.op === 'gte'
        ? Prisma.sql`total_spent >= ${c.value}`
        : Prisma.sql`total_spent <= ${c.value}`;
    case 'lastOrderDaysAgo':
      return c.op === 'lte'
        ? Prisma.sql`last_order_at >= now() - ${Prisma.raw(DAY)}${c.value})`
        : Prisma.sql`last_order_at < now() - ${Prisma.raw(DAY)}${c.value})`;
    case 'createdDaysAgo':
      return c.op === 'lte'
        ? Prisma.sql`created_at >= now() - ${Prisma.raw(DAY)}${c.value})`
        : Prisma.sql`created_at < now() - ${Prisma.raw(DAY)}${c.value})`;
    case 'acceptsMarketing':
      return Prisma.sql`accepts_marketing = ${c.value}`;
    case 'hasAccount':
      return Prisma.sql`has_account = ${c.value}`;
  }
}

/** Active customers with their paid-order stats, filtered by every condition. */
function membersQuery(storeId: string, conditions: SegmentCondition[]): Prisma.Sql {
  const where = conditions.length
    ? Prisma.join(conditions.map(conditionSql), ' AND ')
    : Prisma.sql`TRUE`;
  return Prisma.sql`
    WITH stats AS (
      SELECT c.id, c.email, c.name, c."createdAt" AS created_at,
             c."passwordHash" IS NOT NULL AS has_account,
             c."acceptsMarketing" AS accepts_marketing,
             COUNT(o.id)::int AS orders_count,
             COALESCE(SUM(o.total), 0)::int AS total_spent,
             MAX(o."paidAt") AS last_order_at
      FROM "Customer" c
      LEFT JOIN "Order" o ON o."customerId" = c.id AND o."storeId" = c."storeId"
        AND o."financialStatus" IN ('PAID', 'PARTIALLY_REFUNDED')
      WHERE c."storeId" = ${storeId}::uuid AND c."disabledAt" IS NULL
      GROUP BY c.id
    )
    SELECT * FROM stats WHERE ${where}`;
}

@Injectable()
export class SegmentsService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly audit: AuditService,
  ) {}

  list(storeId: string): Promise<Segment[]> {
    return this.tenantDb.run(storeId, async (tx) => {
      const rows = await tx.customerSegment.findMany({
        where: { storeId },
        orderBy: { name: 'asc' },
      });
      return Promise.all(
        rows.map(async (r) => {
          const conditions = storedConditions.parse(r.conditions);
          return {
            id: r.id,
            name: r.name,
            conditions,
            customerCount: await this.count(tx, storeId, conditions),
            updatedAt: r.updatedAt.toISOString(),
          };
        }),
      );
    });
  }

  get(storeId: string, id: string): Promise<Segment> {
    return this.tenantDb.run(storeId, async (tx) => {
      const row = await this.find(tx, storeId, id);
      const conditions = storedConditions.parse(row.conditions);
      return {
        id: row.id,
        name: row.name,
        conditions,
        customerCount: await this.count(tx, storeId, conditions),
        updatedAt: row.updatedAt.toISOString(),
      };
    });
  }

  /** Counts matches for unsaved conditions (live preview in the editor). */
  preview(storeId: string, conditions: SegmentCondition[]): Promise<{ customerCount: number }> {
    return this.tenantDb.run(storeId, async (tx) => ({
      customerCount: await this.count(tx, storeId, conditions),
    }));
  }

  async create(storeId: string, input: SegmentInput, actor: AuthUser, meta: RequestMeta) {
    const id = await this.tenantDb.run(storeId, async (tx) => {
      const created = await tx.customerSegment.create({
        data: { storeId, name: input.name, conditions: input.conditions },
      });
      await this.record(tx, storeId, actor, 'segment.created', created.id, input.name, meta);
      return created.id;
    });
    return this.get(storeId, id);
  }

  async update(
    storeId: string,
    id: string,
    input: SegmentInput,
    actor: AuthUser,
    meta: RequestMeta,
  ) {
    await this.tenantDb.run(storeId, async (tx) => {
      await this.find(tx, storeId, id);
      await tx.customerSegment.update({
        where: { id },
        data: { name: input.name, conditions: input.conditions },
      });
      await this.record(tx, storeId, actor, 'segment.updated', id, input.name, meta);
    });
    return this.get(storeId, id);
  }

  remove(storeId: string, id: string, actor: AuthUser, meta: RequestMeta): Promise<void> {
    return this.tenantDb.run(storeId, async (tx) => {
      const row = await this.find(tx, storeId, id);
      await tx.customerSegment.delete({ where: { id } });
      await this.record(tx, storeId, actor, 'segment.deleted', id, row.name, meta);
    });
  }

  members(storeId: string, id: string, page: PaginationQuery): Promise<SegmentMembers> {
    return this.tenantDb.run(storeId, async (tx) => {
      const conditions = storedConditions.parse((await this.find(tx, storeId, id)).conditions);
      const query = membersQuery(storeId, conditions);
      const rows = await tx.$queryRaw<MemberRow[]>`
        ${query} ORDER BY total_spent DESC, created_at DESC
        LIMIT ${page.pageSize} OFFSET ${(page.page - 1) * page.pageSize}`;
      return {
        items: rows.map((r) => ({
          id: r.id,
          email: r.email,
          name: r.name,
          hasAccount: r.has_account,
          acceptsMarketing: r.accepts_marketing,
          ordersCount: r.orders_count,
          totalSpent: r.total_spent,
          lastOrderAt: r.last_order_at?.toISOString() ?? null,
          createdAt: r.created_at.toISOString(),
        })),
        page: page.page,
        pageSize: page.pageSize,
        total: await this.count(tx, storeId, conditions),
      };
    });
  }

  /** Every member as CSV (email marketing tools, spreadsheets). Audited: it exports personal data. */
  export(storeId: string, id: string, actor: AuthUser, meta: RequestMeta) {
    return this.tenantDb.run(storeId, async (tx) => {
      const segment = await this.find(tx, storeId, id);
      const conditions = storedConditions.parse(segment.conditions);
      const rows = await tx.$queryRaw<MemberRow[]>`
        ${membersQuery(storeId, conditions)} ORDER BY email LIMIT 100000`;
      await this.record(tx, storeId, actor, 'segment.exported', id, segment.name, meta);
      return {
        filename: `segment-${segment.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`,
        csv: toCsv([
          [
            'Email',
            'Name',
            'Accepts marketing',
            'Paid orders',
            'Total spent (minor units)',
            'Last order',
          ],
          ...rows.map((r) => [
            r.email,
            r.name ?? '',
            r.accepts_marketing ? 'yes' : 'no',
            r.orders_count,
            r.total_spent,
            r.last_order_at?.toISOString().slice(0, 10) ?? '',
          ]),
        ]),
      };
    });
  }

  private async count(tx: TenantTx, storeId: string, conditions: SegmentCondition[]) {
    const [row] = await tx.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM (${membersQuery(storeId, conditions)}) matched`;
    return row?.count ?? 0;
  }

  private async find(tx: TenantTx, storeId: string, id: string) {
    const row = await tx.customerSegment.findFirst({ where: { id, storeId } });
    if (!row) throw new NotFoundException('Segment not found.');
    return row;
  }

  private record(
    tx: TenantTx,
    storeId: string,
    actor: AuthUser,
    action: string,
    id: string,
    name: string,
    meta: RequestMeta,
  ) {
    return this.audit.record(tx, {
      storeId,
      actorUserId: actor.id,
      action,
      entityType: 'segment',
      entityId: id,
      data: { name },
      meta,
    });
  }
}

const previewInputSchema = z.strictObject({ conditions: segmentInputSchema.shape.conditions });

@ApiTags('customers')
@ApiBearerAuth()
@UseGuards(StoreAccessGuard)
@Controller('admin/stores/:storeId/segments')
export class SegmentsController {
  constructor(private readonly segments: SegmentsService) {}

  @Get()
  @RequirePermission('customers:read')
  list(@CurrentStore() store: StoreContext): Promise<Segment[]> {
    return this.segments.list(store.id);
  }

  @Post('preview')
  @HttpCode(200)
  @RequirePermission('customers:read')
  @ApiZodBody(previewInputSchema)
  preview(
    @CurrentStore() store: StoreContext,
    @Body(new ZodPipe(previewInputSchema)) body: z.output<typeof previewInputSchema>,
  ): Promise<{ customerCount: number }> {
    return this.segments.preview(store.id, body.conditions);
  }

  @Post()
  @RequirePermission('customers:write')
  @ApiZodBody(segmentInputSchema)
  create(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(segmentInputSchema)) body: SegmentInput,
    @ReqMeta() meta: RequestMeta,
  ): Promise<Segment> {
    return this.segments.create(store.id, body, user, meta);
  }

  @Get(':segmentId')
  @RequirePermission('customers:read')
  get(
    @CurrentStore() store: StoreContext,
    @Param('segmentId', UuidParam) id: string,
  ): Promise<Segment> {
    return this.segments.get(store.id, id);
  }

  @Put(':segmentId')
  @RequirePermission('customers:write')
  @ApiZodBody(segmentInputSchema)
  update(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('segmentId', UuidParam) id: string,
    @Body(new ZodPipe(segmentInputSchema)) body: SegmentInput,
    @ReqMeta() meta: RequestMeta,
  ): Promise<Segment> {
    return this.segments.update(store.id, id, body, user, meta);
  }

  @Delete(':segmentId')
  @HttpCode(204)
  @RequirePermission('customers:write')
  remove(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('segmentId', UuidParam) id: string,
    @ReqMeta() meta: RequestMeta,
  ): Promise<void> {
    return this.segments.remove(store.id, id, user, meta);
  }

  @Get(':segmentId/customers')
  @RequirePermission('customers:read')
  members(
    @CurrentStore() store: StoreContext,
    @Param('segmentId', UuidParam) id: string,
    @Query(new ZodPipe(paginationQuerySchema)) page: PaginationQuery,
  ): Promise<SegmentMembers> {
    return this.segments.members(store.id, id, page);
  }

  @Get(':segmentId/export')
  @RequirePermission('customers:read')
  export(
    @CurrentStore() store: StoreContext,
    @CurrentUser() user: AuthUser,
    @Param('segmentId', UuidParam) id: string,
    @ReqMeta() meta: RequestMeta,
  ): Promise<{ filename: string; csv: string }> {
    return this.segments.export(store.id, id, user, meta);
  }
}
