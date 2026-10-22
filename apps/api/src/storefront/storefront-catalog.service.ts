import { createHash, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type {
  ProductCard,
  ProductCardPage,
  Shop,
  StorefrontCollection,
  StorefrontProduct,
  StorefrontProductQuery,
  StorefrontSitemap,
} from '@repo/contracts';
import { Prisma, type TenantTx } from '@repo/db';
import { decryptSecret } from '../common/crypto.js';
import { ENV, type Env } from '../config/env.js';
import { TenantDb } from '../database/database.module.js';
import { OnlineStoreService } from '../online-store/online-store.service.js';
import { MediaUrls } from '../storage/storage.module.js';
import { storefrontAccessToken } from './storefront.guard.js';
import { type ShopContext, shopPrice } from './store-resolver.js';

interface CardRow {
  id: string;
  title: string;
  handle: string;
  min_price: number;
  max_price: number;
  compare_at: number | null;
  available: boolean;
  image_key: string | null;
  image_alt: string | null;
}

/** Turns free text into a prefix-matching tsquery: "blue sho" -> "blue:* & sho:*". */
export function toPrefixTsQuery(input: string): string | null {
  const words = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .match(/[\p{L}\p{N}]+/gu);
  if (!words || words.length === 0) return null;
  return words
    .slice(0, 8)
    .map((w) => `${w}:*`)
    .join(' & ');
}

export function isVariantAvailable(v: {
  trackInventory: boolean;
  allowBackorder: boolean;
  inventoryQuantity: number;
}): boolean {
  return !v.trackInventory || v.allowBackorder || v.inventoryQuantity > 0;
}

@Injectable()
export class StorefrontCatalogService {
  constructor(
    private readonly tenantDb: TenantDb,
    private readonly media: MediaUrls,
    private readonly onlineStore: OnlineStoreService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async shop(shop: ShopContext, locked = false): Promise<Shop> {
    return this.tenantDb.run(shop.id, async (tx) => {
      if (locked) {
        // The password page shows only the store's name, message and branding.
        return {
          name: shop.name,
          subdomain: shop.subdomain,
          currency: shop.currency,
          contactEmail: shop.contactEmail,
          collections: [],
          theme: shop.theme,
          menus: { main: [], footer: [] },
          policies: [],
          locked: true,
          passwordMessage: shop.passwordMessage,
          baseCurrency: shop.baseCurrency,
          currencies: [],
        };
      }
      const collections = await tx.collection.findMany({
        where: { storeId: shop.id, published: true },
        orderBy: { title: 'asc' },
        select: { title: true, handle: true },
        take: 20,
      });
      const navigation = await this.onlineStore.storefrontNavigation(tx, shop.id, collections);
      return {
        name: shop.name,
        subdomain: shop.subdomain,
        currency: shop.currency,
        contactEmail: shop.contactEmail,
        collections,
        theme: shop.theme,
        ...navigation,
        locked: false,
        passwordMessage: '',
        baseCurrency: shop.baseCurrency,
        currencies: [shop.baseCurrency, ...shop.presentmentCurrencies.map((c) => c.currency)],
      };
    });
  }

  /** Checks the storefront password; the token proves it on later requests. */
  async unlock(shop: ShopContext, password: string): Promise<{ accessToken: string }> {
    const store = await this.tenantDb.run(shop.id, (tx) =>
      tx.store.findUniqueOrThrow({ where: { id: shop.id } }),
    );
    const current = store.storefrontPasswordEncrypted
      ? decryptSecret(this.env.APP_ENCRYPTION_KEY, store.storefrontPasswordEncrypted)
      : null;
    const a = createHash('sha256').update(password).digest();
    const b = createHash('sha256')
      .update(current ?? '')
      .digest();
    if (!shop.accessVersion || !current || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('That password is not right.');
    }
    return {
      accessToken: storefrontAccessToken(
        this.env.STOREFRONT_SHARED_SECRET,
        shop.id,
        shop.accessVersion,
      ),
    };
  }

  /** Everything a crawler may index (capped; large catalogs list their newest items first). */
  sitemap(shop: ShopContext): Promise<StorefrontSitemap> {
    return this.tenantDb.run(shop.id, async (tx) => {
      const select = { handle: true, updatedAt: true } as const;
      const [products, collections, pages, policies, posts] = await Promise.all([
        tx.product.findMany({
          where: { storeId: shop.id, status: 'ACTIVE' },
          orderBy: { updatedAt: 'desc' },
          select,
          take: 5000,
        }),
        tx.collection.findMany({
          where: { storeId: shop.id, published: true },
          select,
          take: 1000,
        }),
        tx.page.findMany({ where: { storeId: shop.id, published: true }, select, take: 1000 }),
        tx.storePolicy.findMany({ where: { storeId: shop.id }, select: { kind: true } }),
        tx.blogPost.findMany({
          where: { storeId: shop.id, publishedAt: { not: null, lte: new Date() } },
          orderBy: { publishedAt: 'desc' },
          select,
          take: 1000,
        }),
      ]);
      const entry = (r: { handle: string; updatedAt: Date }) => ({
        handle: r.handle,
        updatedAt: r.updatedAt.toISOString(),
      });
      return {
        products: products.map(entry),
        collections: collections.map(entry),
        pages: pages.map(entry),
        posts: posts.map(entry),
        policies: policies.map((p) => p.kind.toLowerCase()),
      };
    });
  }

  async listProducts(shop: ShopContext, query: StorefrontProductQuery): Promise<ProductCardPage> {
    return this.tenantDb.run(shop.id, async (tx) => {
      const filters: Prisma.Sql[] = [
        Prisma.sql`p."storeId" = ${shop.id}::uuid`,
        Prisma.sql`p.status = 'ACTIVE'`,
      ];

      if (query.collection) {
        const collection = await tx.collection.findFirst({
          where: { storeId: shop.id, handle: query.collection, published: true },
        });
        if (!collection) throw new NotFoundException('Collection not found.');
        filters.push(
          collection.ruleTag
            ? Prisma.sql`p.tags @> ARRAY[${collection.ruleTag}]::text[]`
            : Prisma.sql`p.id IN (SELECT cp."productId" FROM "CollectionProduct" cp WHERE cp."collectionId" = ${collection.id}::uuid)`,
        );
      }

      const tsQuery = query.q ? toPrefixTsQuery(query.q) : null;
      if (query.q && !tsQuery) {
        return { items: [], page: query.page, pageSize: query.pageSize, total: 0 };
      }
      const document = Prisma.sql`app_product_search_document(p.title, p.description, p.tags)`;
      if (tsQuery) filters.push(Prisma.sql`${document} @@ to_tsquery('simple', ${tsQuery})`);

      const where = Prisma.join(filters, ' AND ');
      const order = this.orderBy(query.sort, tsQuery, document);

      const rows = await tx.$queryRaw<CardRow[]>`
        SELECT p.id, p.title, p.handle,
               MIN(v.price)::int AS min_price,
               MAX(v.price)::int AS max_price,
               MAX(v."compareAtPrice")::int AS compare_at,
               BOOL_OR(NOT v."trackInventory" OR v."allowBackorder" OR v."inventoryQuantity" > 0) AS available,
               (SELECT i."storageKey" FROM "ProductImage" i WHERE i."productId" = p.id ORDER BY i.position LIMIT 1) AS image_key,
               (SELECT i.alt FROM "ProductImage" i WHERE i."productId" = p.id ORDER BY i.position LIMIT 1) AS image_alt
        FROM "Product" p
        JOIN "ProductVariant" v ON v."productId" = p.id
        WHERE ${where}
        GROUP BY p.id
        ORDER BY ${order}
        LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`;

      const [counted] = await tx.$queryRaw<{ count: number }[]>`
        SELECT COUNT(*)::int AS count FROM "Product" p WHERE ${where}`;

      return {
        items: rows.map((r) => this.toCard(shop, r)),
        page: query.page,
        pageSize: query.pageSize,
        total: counted?.count ?? 0,
      };
    });
  }

  async getProduct(shop: ShopContext, handle: string): Promise<StorefrontProduct> {
    const product = await this.tenantDb.run(shop.id, (tx) =>
      tx.product.findFirst({
        where: { storeId: shop.id, handle, status: 'ACTIVE' },
        include: {
          options: { orderBy: { position: 'asc' } },
          variants: { orderBy: { position: 'asc' } },
          images: { orderBy: { position: 'asc' } },
        },
      }),
    );
    if (!product) throw new NotFoundException('Product not found.');
    return {
      id: product.id,
      title: product.title,
      handle: product.handle,
      description: product.description,
      vendor: product.vendor,
      productType: product.productType,
      tags: product.tags,
      isGiftCard: product.isGiftCard,
      seoTitle: product.seoTitle,
      seoDescription: product.seoDescription,
      options: product.options.map((o) => ({ name: o.name, values: o.values })),
      variants: product.variants.map((v) => ({
        id: v.id,
        title: v.title,
        options: v.options,
        price: shopPrice(shop, v.price),
        compareAtPrice: v.compareAtPrice === null ? null : shopPrice(shop, v.compareAtPrice),
        available: isVariantAvailable(v),
        sku: v.sku,
      })),
      images: product.images.map((i) => ({
        url: this.media.url(i.storageKey),
        alt: i.alt || product.title,
        width: i.width,
        height: i.height,
      })),
    };
  }

  async collections(shop: ShopContext): Promise<StorefrontCollection[]> {
    return this.tenantDb.run(shop.id, (tx) =>
      tx.collection.findMany({
        where: { storeId: shop.id, published: true },
        orderBy: { title: 'asc' },
        select: { title: true, handle: true, description: true },
      }),
    );
  }

  async collection(shop: ShopContext, handle: string): Promise<StorefrontCollection> {
    const collection = await this.tenantDb.run(shop.id, (tx: TenantTx) =>
      tx.collection.findFirst({
        where: { storeId: shop.id, handle, published: true },
        select: { title: true, handle: true, description: true },
      }),
    );
    if (!collection) throw new NotFoundException('Collection not found.');
    return collection;
  }

  private orderBy(
    sort: StorefrontProductQuery['sort'],
    tsQuery: string | null,
    document: Prisma.Sql,
  ) {
    switch (sort) {
      case 'price-asc':
        return Prisma.sql`min_price ASC, p.id`;
      case 'price-desc':
        return Prisma.sql`max_price DESC, p.id`;
      case 'title':
        return Prisma.sql`p.title ASC, p.id`;
      default:
        return tsQuery
          ? Prisma.sql`ts_rank(${document}, to_tsquery('simple', ${tsQuery})) DESC, p.id`
          : Prisma.sql`p."publishedAt" DESC NULLS LAST, p."createdAt" DESC, p.id`;
    }
  }

  private toCard(shop: ShopContext, r: CardRow): ProductCard {
    return {
      id: r.id,
      title: r.title,
      handle: r.handle,
      minPrice: shopPrice(shop, r.min_price),
      maxPrice: shopPrice(shop, r.max_price),
      compareAtPrice: r.compare_at === null ? null : shopPrice(shop, r.compare_at),
      available: r.available,
      imageUrl: r.image_key ? this.media.url(r.image_key) : null,
      imageAlt: r.image_alt || r.title,
    };
  }
}
