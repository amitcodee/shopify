import { Injectable, NotFoundException } from '@nestjs/common';
import {
  MENU_HANDLES,
  type Menu as MenuDto,
  type MenuHandle,
  type MenuItem,
  menuItemSchema,
  type Page as PageDto,
  type pageInputSchema,
  POLICY_KINDS,
  POLICY_TITLES,
  type Policy as PolicyDto,
  type PolicyKind,
  type ResolvedLink,
  type StorefrontPage,
} from '@repo/contracts';
import type { Page, PolicyKind as DbPolicyKind, TenantTx } from '@repo/db';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service.js';
import { uniqueHandle } from '../catalog/handles.js';
import type { AuthUser, RequestMeta } from '../common/request.js';
import { TenantDb } from '../database/database.module.js';

type PageInput = z.output<typeof pageInputSchema>;

const toDbKind = (kind: PolicyKind) => kind.toUpperCase() as DbPolicyKind;
const fromDbKind = (kind: DbPolicyKind) => kind.toLowerCase() as PolicyKind;

/** Stored menu items, re-validated on read so a bad row can never reach a storefront. */
const storedItemsSchema = z.array(z.unknown()).catch([]);
function parseItems(value: unknown): MenuItem[] {
  return storedItemsSchema.parse(value).flatMap((item) => {
    const parsed = menuItemSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

/** Footer links until the merchant saves a footer menu (published policies are always listed). */
const DEFAULT_FOOTER: MenuItem[] = [{ title: 'Search', link: { type: 'search' } }];

@Injectable()
export class OnlineStoreService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly audit: AuditService,
  ) {}

  // ---- Pages ----

  private toPageDto(p: Page): PageDto {
    return {
      id: p.id,
      title: p.title,
      handle: p.handle,
      body: p.body,
      published: p.published,
      updatedAt: p.updatedAt.toISOString(),
    };
  }

  listPages(storeId: string): Promise<PageDto[]> {
    return this.tenantDb.run(storeId, async (tx) => {
      const rows = await tx.page.findMany({ where: { storeId }, orderBy: { title: 'asc' } });
      return rows.map((p) => this.toPageDto(p));
    });
  }

  getPage(storeId: string, id: string): Promise<PageDto> {
    return this.tenantDb.run(storeId, async (tx) =>
      this.toPageDto(await this.findPage(tx, storeId, id)),
    );
  }

  createPage(storeId: string, input: PageInput, actor: AuthUser, meta: RequestMeta) {
    return this.tenantDb.run(storeId, async (tx) => {
      const handle = await uniqueHandle(input.handle, input.title, async (h) =>
        Boolean(await tx.page.findFirst({ where: { storeId, handle: h } })),
      );
      const created = await tx.page.create({
        data: {
          storeId,
          title: input.title,
          handle,
          body: input.body,
          published: input.published,
        },
      });
      await this.audit.record(tx, {
        storeId,
        actorUserId: actor.id,
        action: 'page.created',
        entityType: 'page',
        entityId: created.id,
        data: { title: created.title },
        meta,
      });
      return this.toPageDto(created);
    });
  }

  updatePage(storeId: string, id: string, input: PageInput, actor: AuthUser, meta: RequestMeta) {
    return this.tenantDb.run(storeId, async (tx) => {
      const existing = await this.findPage(tx, storeId, id);
      const handle =
        input.handle && input.handle !== existing.handle
          ? await uniqueHandle(input.handle, input.title, async (h) =>
              Boolean(await tx.page.findFirst({ where: { storeId, handle: h } })),
            )
          : existing.handle;
      const updated = await tx.page.update({
        where: { id },
        data: { title: input.title, handle, body: input.body, published: input.published },
      });
      await this.audit.record(tx, {
        storeId,
        actorUserId: actor.id,
        action: 'page.updated',
        entityType: 'page',
        entityId: id,
        meta,
      });
      return this.toPageDto(updated);
    });
  }

  removePage(storeId: string, id: string, actor: AuthUser, meta: RequestMeta): Promise<void> {
    return this.tenantDb.run(storeId, async (tx) => {
      const page = await this.findPage(tx, storeId, id);
      await tx.page.delete({ where: { id } });
      await this.audit.record(tx, {
        storeId,
        actorUserId: actor.id,
        action: 'page.deleted',
        entityType: 'page',
        entityId: id,
        data: { title: page.title },
        meta,
      });
    });
  }

  private async findPage(tx: TenantTx, storeId: string, id: string): Promise<Page> {
    const page = await tx.page.findFirst({ where: { id, storeId } });
    if (!page) throw new NotFoundException('Page not found.');
    return page;
  }

  // ---- Policies ----

  listPolicies(storeId: string): Promise<PolicyDto[]> {
    return this.tenantDb.run(storeId, async (tx) => {
      const rows = await tx.storePolicy.findMany({ where: { storeId } });
      const byKind = new Map(rows.map((r) => [fromDbKind(r.kind), r]));
      return POLICY_KINDS.map((kind) => {
        const row = byKind.get(kind);
        return {
          kind,
          title: POLICY_TITLES[kind],
          body: row?.body ?? '',
          updatedAt: row?.updatedAt.toISOString() ?? null,
        };
      });
    });
  }

  setPolicy(
    storeId: string,
    kind: PolicyKind,
    body: string,
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<PolicyDto> {
    return this.tenantDb.run(storeId, async (tx) => {
      const where = { storeId_kind: { storeId, kind: toDbKind(kind) } };
      let updatedAt: string | null = null;
      if (body) {
        const row = await tx.storePolicy.upsert({
          where,
          create: { storeId, kind: toDbKind(kind), body },
          update: { body },
        });
        updatedAt = row.updatedAt.toISOString();
      } else {
        await tx.storePolicy.deleteMany({ where: { storeId, kind: toDbKind(kind) } });
      }
      await this.audit.record(tx, {
        storeId,
        actorUserId: actor.id,
        action: body ? 'policy.updated' : 'policy.removed',
        entityType: 'policy',
        entityId: null,
        data: { kind },
        meta,
      });
      return { kind, title: POLICY_TITLES[kind], body, updatedAt };
    });
  }

  // ---- Menus ----

  listMenus(storeId: string): Promise<MenuDto[]> {
    return this.tenantDb.run(storeId, async (tx) => {
      const rows = await tx.menu.findMany({ where: { storeId } });
      const byHandle = new Map(rows.map((r) => [r.handle, r]));
      return MENU_HANDLES.map((handle) => {
        const row = byHandle.get(handle);
        return { handle, items: row ? parseItems(row.items) : [], customized: Boolean(row) };
      });
    });
  }

  setMenu(
    storeId: string,
    handle: MenuHandle,
    items: MenuItem[],
    actor: AuthUser,
    meta: RequestMeta,
  ): Promise<MenuDto> {
    return this.tenantDb.run(storeId, async (tx) => {
      await tx.menu.upsert({
        where: { storeId_handle: { storeId, handle } },
        create: { storeId, handle, items },
        update: { items },
      });
      await this.audit.record(tx, {
        storeId,
        actorUserId: actor.id,
        action: 'menu.updated',
        entityType: 'menu',
        entityId: null,
        data: { handle, count: items.length },
        meta,
      });
      return { handle, items, customized: true };
    });
  }

  resetMenu(storeId: string, handle: MenuHandle, actor: AuthUser, meta: RequestMeta) {
    return this.tenantDb.run(storeId, async (tx) => {
      await tx.menu.deleteMany({ where: { storeId, handle } });
      await this.audit.record(tx, {
        storeId,
        actorUserId: actor.id,
        action: 'menu.reset',
        entityType: 'menu',
        entityId: null,
        data: { handle },
        meta,
      });
    });
  }

  // ---- Storefront ----

  /** Published policies and resolved menus for the storefront layout. */
  async storefrontNavigation(
    tx: TenantTx,
    storeId: string,
    collections: { title: string; handle: string }[],
  ): Promise<{
    menus: { main: ResolvedLink[]; footer: ResolvedLink[] };
    policies: { kind: PolicyKind; title: string }[];
  }> {
    const [policyRows, menuRows] = await Promise.all([
      tx.storePolicy.findMany({ where: { storeId }, select: { kind: true } }),
      tx.menu.findMany({ where: { storeId } }),
    ]);
    const published = new Set(policyRows.map((r) => fromDbKind(r.kind)));
    const policies = POLICY_KINDS.filter((k) => published.has(k)).map((kind) => ({
      kind,
      title: POLICY_TITLES[kind],
    }));

    const stored = new Map(menuRows.map((r) => [r.handle, parseItems(r.items)]));
    const main = stored.get('main') ?? [
      { title: 'Shop all', link: { type: 'catalog' } },
      ...collections
        .slice(0, 5)
        .map((c): MenuItem => ({ title: c.title, link: { type: 'collection', handle: c.handle } })),
    ];
    const footer = stored.get('footer') ?? DEFAULT_FOOTER;

    const resolve = await this.linkResolver(tx, storeId, [...main, ...footer], published);
    return {
      menus: { main: main.flatMap(resolve), footer: footer.flatMap(resolve) },
      policies,
    };
  }

  /** Builds a resolver that drops links to missing, hidden or draft targets. */
  private async linkResolver(
    tx: TenantTx,
    storeId: string,
    items: MenuItem[],
    publishedPolicies: Set<PolicyKind>,
  ): Promise<(item: MenuItem) => ResolvedLink[]> {
    const handles = (type: 'collection' | 'product' | 'page') =>
      items.flatMap((i) => (i.link.type === type ? [i.link.handle] : []));
    const [collections, products, pages] = await Promise.all([
      tx.collection.findMany({
        where: { storeId, published: true, handle: { in: handles('collection') } },
        select: { handle: true },
      }),
      tx.product.findMany({
        where: { storeId, status: 'ACTIVE', handle: { in: handles('product') } },
        select: { handle: true },
      }),
      tx.page.findMany({
        where: { storeId, published: true, handle: { in: handles('page') } },
        select: { handle: true },
      }),
    ]);
    const live = {
      collection: new Set(collections.map((c) => c.handle)),
      product: new Set(products.map((p) => p.handle)),
      page: new Set(pages.map((p) => p.handle)),
    };

    return ({ title, link }) => {
      const internal = (href: string): ResolvedLink[] => [{ title, href, external: false }];
      switch (link.type) {
        case 'home':
          return internal('/');
        case 'catalog':
          return internal('/collections/all');
        case 'search':
          return internal('/search');
        case 'collection':
          return live.collection.has(link.handle) ? internal(`/collections/${link.handle}`) : [];
        case 'product':
          return live.product.has(link.handle) ? internal(`/products/${link.handle}`) : [];
        case 'page':
          return live.page.has(link.handle) ? internal(`/pages/${link.handle}`) : [];
        case 'policy':
          return publishedPolicies.has(link.kind) ? internal(`/policies/${link.kind}`) : [];
        case 'url':
          return link.url.startsWith('/')
            ? internal(link.url)
            : [{ title, href: link.url, external: true }];
      }
    };
  }

  storefrontPage(storeId: string, handle: string): Promise<StorefrontPage> {
    return this.tenantDb.run(storeId, async (tx) => {
      const page = await tx.page.findFirst({ where: { storeId, handle, published: true } });
      if (!page) throw new NotFoundException('Page not found.');
      return { title: page.title, handle: page.handle, body: page.body };
    });
  }

  storefrontPolicy(storeId: string, kind: PolicyKind): Promise<PolicyDto> {
    return this.tenantDb.run(storeId, async (tx) => {
      const row = await tx.storePolicy.findUnique({
        where: { storeId_kind: { storeId, kind: toDbKind(kind) } },
      });
      if (!row) throw new NotFoundException('Policy not found.');
      return {
        kind,
        title: POLICY_TITLES[kind],
        body: row.body,
        updatedAt: row.updatedAt.toISOString(),
      };
    });
  }
}
