import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@repo/db';
import sharp from 'sharp';
import { LocalDiskStorage } from './storage/storage.js';

interface SeedProduct {
  title: string;
  description: string;
  vendor: string;
  productType: string;
  tags: string[];
  color: string;
  options: { name: string; values: string[] }[];
  /** Base price in cents; variants add `step` per option index. */
  price: number;
  compareAt?: number;
  stock: number;
}

const PRODUCTS: SeedProduct[] = [
  {
    title: 'Everyday Cotton Tee',
    description: 'A soft, breathable tee for every day.\n\nMade from 100% organic cotton.',
    vendor: 'Demo Outfitters',
    productType: 'T-Shirts',
    tags: ['summer', 'cotton', 'bestseller'],
    color: '#2563eb',
    options: [
      { name: 'Size', values: ['S', 'M', 'L'] },
      { name: 'Color', values: ['Blue', 'Black'] },
    ],
    price: 2400,
    stock: 12,
  },
  {
    title: 'Trail Running Shoes',
    description: 'Lightweight shoes with grippy soles for any trail.',
    vendor: 'Demo Outfitters',
    productType: 'Shoes',
    tags: ['outdoor', 'bestseller'],
    color: '#16a34a',
    options: [{ name: 'Size', values: ['8', '9', '10', '11'] }],
    price: 11900,
    compareAt: 13900,
    stock: 6,
  },
  {
    title: 'Canvas Weekender Bag',
    description: 'Durable waxed canvas with leather handles. Fits a weekend of essentials.',
    vendor: 'Demo Outfitters',
    productType: 'Bags',
    tags: ['travel'],
    color: '#b45309',
    options: [],
    price: 8900,
    stock: 4,
  },
  {
    title: 'Merino Beanie',
    description: 'Warm, itch-free merino wool beanie.',
    vendor: 'Demo Outfitters',
    productType: 'Accessories',
    tags: ['winter', 'wool'],
    color: '#7c3aed',
    options: [{ name: 'Color', values: ['Plum', 'Charcoal'] }],
    price: 3200,
    stock: 20,
  },
  {
    title: 'Linen Summer Shirt',
    description: 'Relaxed-fit linen shirt that keeps you cool.',
    vendor: 'Demo Outfitters',
    productType: 'Shirts',
    tags: ['summer', 'linen'],
    color: '#0891b2',
    options: [{ name: 'Size', values: ['S', 'M', 'L'] }],
    price: 5800,
    stock: 8,
  },
  {
    title: 'Insulated Water Bottle',
    description: 'Keeps drinks cold for 24 hours or hot for 12.',
    vendor: 'Demo Outfitters',
    productType: 'Accessories',
    tags: ['outdoor', 'travel'],
    color: '#dc2626',
    options: [{ name: 'Capacity', values: ['500 ml', '750 ml'] }],
    price: 2900,
    stock: 30,
  },
  {
    title: 'Wool Blend Overcoat',
    description: 'A timeless overcoat for cold city days.',
    vendor: 'Demo Outfitters',
    productType: 'Outerwear',
    tags: ['winter'],
    color: '#334155',
    options: [{ name: 'Size', values: ['M', 'L'] }],
    price: 24900,
    compareAt: 29900,
    stock: 3,
  },
  {
    title: 'Sunglasses — Classic',
    description: 'Polarized lenses with UV400 protection.',
    vendor: 'Demo Outfitters',
    productType: 'Accessories',
    tags: ['summer'],
    color: '#ca8a04',
    options: [],
    price: 4500,
    stock: 15,
  },
];

function combinations(options: { values: string[] }[]): string[][] {
  return options.reduce<string[][]>(
    (acc, o) => acc.flatMap((p) => o.values.map((v) => [...p, v])),
    [[]],
  );
}

function escapeXml(text: string): string {
  return text.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

async function placeholderImage(title: string, color: string): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="#0f172a"/></linearGradient></defs>
    <rect width="800" height="800" fill="url(#g)"/>
    <text x="400" y="420" font-family="Arial, sans-serif" font-size="44" fill="#fff" text-anchor="middle">${escapeXml(title)}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).webp({ quality: 80 }).toBuffer();
}

/** Demo catalog for the seeded store; skipped when the store already has products. */
export async function seedCatalog(db: PrismaClient, storeId: string): Promise<void> {
  const location =
    (await db.location.findFirst({ where: { storeId, isDefault: true } })) ??
    (await db.location.create({ data: { storeId, name: 'Main location', isDefault: true } }));
  if ((await db.product.count({ where: { storeId } })) > 0) return;
  const storage = new LocalDiskStorage(process.env.STORAGE_DIR ?? 'storage');
  const productIds: Record<string, string> = {};

  for (const p of PRODUCTS) {
    const handle = p.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const product = await db.product.create({
      data: {
        storeId,
        title: p.title,
        handle,
        description: p.description,
        status: 'ACTIVE',
        publishedAt: new Date(),
        vendor: p.vendor,
        productType: p.productType,
        tags: p.tags,
        options: {
          create: p.options.map((o, position) => ({ name: o.name, values: o.values, position })),
        },
      },
    });
    productIds[p.title] = product.id;

    for (const [position, combo] of combinations(p.options).entries()) {
      const variant = await db.productVariant.create({
        data: {
          storeId,
          productId: product.id,
          title: combo.length ? combo.join(' / ') : 'Default',
          options: combo,
          sku: `${handle.slice(0, 12).toUpperCase()}-${position + 1}`,
          price: p.price + (combo[0] === 'L' || combo[0] === '750 ml' ? 200 : 0),
          compareAtPrice: p.compareAt ?? null,
          weightGrams: 400,
          inventoryQuantity: p.stock,
          position,
        },
      });
      await db.inventoryLevel.create({
        data: { storeId, variantId: variant.id, locationId: location.id, available: p.stock },
      });
      await db.inventoryAdjustment.create({
        data: {
          storeId,
          variantId: variant.id,
          delta: p.stock,
          quantityAfter: p.stock,
          reason: 'INITIAL',
          locationId: location.id,
        },
      });
    }

    const key = `stores/${storeId}/products/${randomUUID()}.webp`;
    await storage.put(key, await placeholderImage(p.title, p.color));
    await db.productImage.create({
      data: {
        storeId,
        productId: product.id,
        storageKey: key,
        alt: p.title,
        width: 800,
        height: 800,
      },
    });
  }

  const newArrivals = await db.collection.create({
    data: {
      storeId,
      title: 'New Arrivals',
      handle: 'new-arrivals',
      description: 'Fresh picks for the season.',
    },
  });
  const picks = [
    'Linen Summer Shirt',
    'Trail Running Shoes',
    'Merino Beanie',
    'Canvas Weekender Bag',
  ];
  await db.collectionProduct.createMany({
    data: picks.map((title, position) => ({
      storeId,
      collectionId: newArrivals.id,
      productId: productIds[title] ?? '',
      position,
    })),
  });
  await db.collection.create({
    data: {
      storeId,
      title: 'Summer Essentials',
      handle: 'summer',
      description: 'Light layers and sunny-day gear.',
      ruleTag: 'summer',
    },
  });
  await db.collection.create({
    data: {
      storeId,
      title: 'Outdoor',
      handle: 'outdoor',
      description: 'Built for the trail.',
      ruleTag: 'outdoor',
    },
  });
}
