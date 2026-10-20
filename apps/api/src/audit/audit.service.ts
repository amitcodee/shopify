import { Inject, Injectable } from '@nestjs/common';
import type { AuditLogEntry, Paginated, PaginationQuery } from '@repo/contracts';
import type { Prisma, PrismaClient, TenantTx } from '@repo/db';
import type { RequestMeta } from '../common/request.js';
import { APP_DB, TenantDb } from '../database/database.module.js';

export interface AuditEntry {
  storeId: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  data?: Prisma.InputJsonValue;
  meta?: RequestMeta;
}

@Injectable()
export class AuditService {
  constructor(
    private readonly tenantDb: TenantDb,
    @Inject(APP_DB) private readonly db: PrismaClient,
  ) {}

  /** Records an audit entry inside the caller's tenant transaction (same commit as the change). */
  async record(tx: TenantTx, entry: AuditEntry): Promise<void> {
    await tx.auditLog.create({
      data: {
        storeId: entry.storeId,
        actorUserId: entry.actorUserId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        data: entry.data,
        ipAddress: entry.meta?.ipAddress ?? null,
        userAgent: entry.meta?.userAgent ?? null,
      },
    });
  }

  async list(storeId: string, query: PaginationQuery): Promise<Paginated<AuditLogEntry>> {
    const [rows, total] = await this.tenantDb.run(storeId, (tx) =>
      Promise.all([
        tx.auditLog.findMany({
          where: { storeId },
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        tx.auditLog.count({ where: { storeId } }),
      ]),
    );

    const actorIds = [...new Set(rows.map((r) => r.actorUserId).filter((id) => id !== null))];
    const actors = await this.db.user.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, name: true, email: true },
    });
    const byId = new Map(actors.map((a) => [a.id, a]));

    return {
      items: rows.map((r) => ({
        id: r.id,
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId,
        actor: (r.actorUserId && byId.get(r.actorUserId)) || null,
        data: r.data ?? null,
        ipAddress: r.ipAddress,
        createdAt: r.createdAt.toISOString(),
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }
}
