import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PrismaClient } from '@repo/db';
import sharp from 'sharp';
import { ImageProcessor } from './storage/image-processor.js';
import { imageKeys, LocalDiskStorage, renditionKey } from './storage/storage.js';

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

/**
 * Stock product photos (Unsplash License; see packages/assets/CREDITS.md) named
 * `<handle>-<n>.webp`. `src/` and `dist/` both sit one level below the package root.
 */
const SEED_PHOTO_DIR = fileURLToPath(new URL('../seed-assets/products/', import.meta.url));

function handleFor(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** The product's bundled photos in order, or an empty list when none are shipped. */
async function productPhotos(handle: string): Promise<Buffer[]> {
  const photos: Buffer[] = [];
  for (let n = 1; ; n++) {
    const file = path.join(SEED_PHOTO_DIR, `${handle}-${n}.webp`);
    if (!existsSync(file)) return photos;
    photos.push(await readFile(file));
  }
}

function combinations(options: { values: string[] }[]): string[][] {
  return options.reduce<string[][]>(
    (acc, o) => acc.flatMap((p) => o.values.map((v) => [...p, v])),
    [[]],
  );
}

/** Mixes `hex` toward white (amount > 0) or black (amount < 0). */
function shade(hex: string, amount: number): string {
  const target = amount > 0 ? 255 : 0;
  const channels = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16);
    return Math.round(c + (target - c) * Math.abs(amount))
      .toString(16)
      .padStart(2, '0');
  });
  return `#${channels.join('')}`;
}

/**
 * Studio-style placeholder photos without text (the alt text names the product): a soft
 * backdrop with an object, a close-up, and a flat lay, so galleries and hover images have
 * something to show.
 */
async function placeholderImages(color: string): Promise<Buffer[]> {
  const light = shade(color, 0.86);
  const mid = shade(color, 0.55);
  const dark = shade(color, -0.35);
  const scenes = [
    `<rect width="800" height="800" fill="${light}"/>
     <ellipse cx="400" cy="640" rx="230" ry="34" fill="${dark}" opacity="0.18"/>
     <rect x="250" y="190" width="300" height="430" rx="46" fill="url(#g)"/>
     <rect x="290" y="240" width="90" height="300" rx="40" fill="#fff" opacity="0.18"/>`,
    `<rect width="800" height="800" fill="url(#g)"/>
     <circle cx="400" cy="400" r="250" fill="${light}" opacity="0.16"/>
     <circle cx="400" cy="400" r="150" fill="${light}" opacity="0.22"/>
     <path d="M0 620 Q200 540 400 620 T800 620 V800 H0Z" fill="${dark}" opacity="0.35"/>`,
    `<rect width="800" height="800" fill="${shade(color, 0.93)}"/>
     <rect x="120" y="150" width="250" height="250" rx="28" fill="url(#g)"/>
     <rect x="430" y="150" width="250" height="250" rx="125" fill="${mid}"/>
     <rect x="120" y="440" width="560" height="210" rx="28" fill="${shade(color, 0.7)}"/>`,
  ];
  return Promise.all(
    scenes.map((scene) => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800">
        <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="${dark}"/></linearGradient></defs>
        ${scene}
      </svg>`;
      return sharp(Buffer.from(svg)).webp({ quality: 82 }).toBuffer();
    }),
  );
}

/**
 * Replaces a product's images (seed and dev refresh) with its bundled stock photos, falling
 * back to generated placeholders when the product has none.
 */
export async function seedProductImages(
  db: PrismaClient,
  storage: LocalDiskStorage,
  storeId: string,
  productId: string,
  title: string,
  color: string,
): Promise<void> {
  const previous = await db.productImage.findMany({
    where: { storeId, productId },
    select: { storageKey: true, renditionWidths: true },
  });
  await db.productImage.deleteMany({ where: { storeId, productId } });
  for (const key of previous.flatMap(imageKeys)) await storage.delete(key);

  const photos = await productPhotos(handleFor(title));
  const images = photos.length ? photos : await placeholderImages(color);
  // The same pipeline as merchant uploads: WebP plus 200/600/1200/2048 px renditions.
  const processor = new ImageProcessor();
  for (const [position, image] of images.entries()) {
    const processed = await processor.process(image);
    const key = `stores/${storeId}/products/${randomUUID()}.webp`;
    await storage.put(key, processed.data);
    for (const rendition of processed.renditions) {
      await storage.put(renditionKey(key, rendition.width), rendition.data);
    }
    await db.productImage.create({
      data: {
        storeId,
        productId,
        storageKey: key,
        alt: title,
        width: processed.width,
        height: processed.height,
        position,
        renditionWidths: processed.renditions.map((r) => r.width),
      },
    });
  }
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
    const handle = handleFor(p.title);
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

    await seedProductImages(db, storage, storeId, product.id, p.title, p.color);
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

/** Dev helper: re-creates the demo products' images (photos or placeholders) in an existing store. */
export async function refreshDemoImages(db: PrismaClient, storeId: string): Promise<number> {
  const storage = new LocalDiskStorage(process.env.STORAGE_DIR ?? 'storage');
  let count = 0;
  for (const p of PRODUCTS) {
    const product = await db.product.findFirst({ where: { storeId, title: p.title } });
    if (!product) continue;
    await seedProductImages(db, storage, storeId, product.id, p.title, p.color);
    count++;
  }
  return count;
}
