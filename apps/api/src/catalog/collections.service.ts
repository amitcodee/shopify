import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Collection as CollectionDto, collectionInputSchema } from '@repo/contracts';
import type { Collection, TenantTx } from '@repo/db';
import type { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser, RequestMeta } from '../common/request.js';
import { TenantDb } from '../database/database.module.js';
import { uniqueHandle } from './handles.js';

type CollectionInput = z.output<typeof collectionInputSchema>;

@Injectable()
export class CollectionsService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly audit: AuditService,
  ) {}

  /** Product ids in a collection: manual membership, or ACTIVE products with the rule tag. */
  static async productIds(
    tx: TenantTx,
    collection: Collection,
    onlyActive = false,
  ): Promise<string[]> {
    if (collection.ruleTag) {
      const rows = await tx.product.findMany({
        where: { storeId: collection.storeId, status: 'ACTIVE', tags: { has: collection.ruleTag } },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
        take: 500,
      });
      return rows.map((r) => r.id);
    }
    const rows = await tx.collectionProduct.findMany({
      where: {
        collectionId: collection.id,
        storeId: collection.storeId,
        ...(onlyActive ? { product: { status: 'ACTIVE' } } : {}),
      },
      orderBy: { position: 'asc' },
      select: { productId: true },
    });
    return rows.map((r) => r.productId);
  }

  private async toDto(tx: TenantTx, c: Collection): Promise<CollectionDto> {
    const productIds = await CollectionsService.productIds(tx, c);
    return {
      id: c.id,
      title: c.title,
      handle: c.handle,
      description: c.description,
      ruleTag: c.ruleTag,
      published: c.published,
      productCount: productIds.length,
      productIds,
      updatedAt: c.updatedAt.toISOString(),
    };
  }

  list(storeId: string): Promise<CollectionDto[]> {
    return this.tenantDb.run(storeId, async (tx) => {
      const rows = await tx.collection.findMany({ where: { storeId }, orderBy: { title: 'asc' } });
      return Promise.all(rows.map((c) => this.toDto(tx, c)));
    });
  }

  get(storeId: string, id: string): Promise<CollectionDto> {
    return this.tenantDb.run(storeId, async (tx) =>
      this.toDto(tx, await this.find(tx, storeId, id)),
    );
  }

  create(storeId: string, input: CollectionInput, actor: AuthUser, meta: RequestMeta) {
    return this.tenantDb.run(storeId, async (tx) => {
      const handle = await uniqueHandle(input.handle, input.title, async (h) =>
        Boolean(await tx.collection.findFirst({ where: { storeId, handle: h } })),
      );
      const created = await tx.collection.create({
        data: {
          storeId,
          title: input.title,
          handle,
          description: input.description,
          ruleTag: input.ruleTag ?? null,
          published: input.published,
        },
      });
      await this.audit.record(tx, {
        storeId,
        actorUserId: actor.id,
        action: 'collection.created',
        entityType: 'collection',
        entityId: created.id,
        data: { title: created.title },
        meta,
      });
      return this.toDto(tx, created);
    });
  }

  update(storeId: string, id: string, input: CollectionInput, actor: AuthUser, meta: RequestMeta) {
    return this.tenantDb.run(storeId, async (tx) => {
      const existing = await this.find(tx, storeId, id);
      const handle =
        input.handle && input.handle !== existing.handle
          ? await uniqueHandle(input.handle, input.title, async (h) =>
              Boolean(await tx.collection.findFirst({ where: { storeId, handle: h } })),
            )
          : existing.handle;
      const updated = await tx.collection.update({
        where: { id },
        data: {
          title: input.title,
          handle,
          description: input.description,
          ruleTag: input.ruleTag ?? null,
          published: input.published,
        },
      });
      await this.audit.record(tx, {
        storeId,
        actorUserId: actor.id,
        action: 'collection.updated',
        entityType: 'collection',
        entityId: id,
        meta,
      });
      return this.toDto(tx, updated);
    });
  }

  setProducts(
    storeId: string,
    id: string,
    productIds: string[],
    actor: AuthUser,
    meta: RequestMeta,
  ) {
    return this.tenantDb.run(storeId, async (tx) => {
      const collection = await this.find(tx, storeId, id);
      if (collection.ruleTag) {
        throw new BadRequestException('Automated collections are filled by their tag rule.');
      }
      const unique = [...new Set(productIds)];
      const found = await tx.product.count({ where: { storeId, id: { in: unique } } });
      if (found !== unique.length) throw new BadRequestException('Unknown product id.');

      await tx.collectionProduct.deleteMany({ where: { collectionId: id, storeId } });
      await tx.collectionProduct.createMany({
        data: unique.map((productId, position) => ({
          storeId,
          collectionId: id,
          productId,
          position,
        })),
      });
      await this.audit.record(tx, {
        storeId,
        actorUserId: actor.id,
        action: 'collection.products_set',
        entityType: 'collection',
        entityId: id,
        data: { count: unique.length },
        meta,
      });
      return this.toDto(tx, collection);
    });
  }

  remove(storeId: string, id: string, actor: AuthUser, meta: RequestMeta): Promise<void> {
    return this.tenantDb.run(storeId, async (tx) => {
      const collection = await this.find(tx, storeId, id);
      await tx.collection.delete({ where: { id } });
      await this.audit.record(tx, {
        storeId,
        actorUserId: actor.id,
        action: 'collection.deleted',
        entityType: 'collection',
        entityId: id,
        data: { title: collection.title },
        meta,
      });
    });
  }

  private async find(tx: TenantTx, storeId: string, id: string): Promise<Collection> {
    const collection = await tx.collection.findFirst({ where: { id, storeId } });
    if (!collection) throw new NotFoundException('Collection not found.');
    return collection;
  }
}
