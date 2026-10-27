import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@repo/db';
import { bundleStock } from './catalog/bundles.js';
import { seedProductImages } from './seed-catalog.js';
import { LocalDiskStorage } from './storage/storage.js';

/**
 * Demo data for suppliers, swatches, personalisation and bundles in the seeded store. Safe to
 * run again: each part is skipped when it already exists, and only demo products are touched.
 */
export async function seedMerchandising(db: PrismaClient, storeId: string): Promise<void> {
  const product = (title: string) => db.product.findFirst({ where: { storeId, title } });

  // A supplier for the apparel, with a realistic lead time.
  let supplier = await db.supplier.findFirst({ where: { storeId, name: 'Demo Textile Co.' } });
  if (!supplier) {
    supplier = await db.supplier.create({
      data: {
        storeId,
        name: 'Demo Textile Co.',
        contactName: 'Sample contact',
        email: 'orders@supplier.example',
        leadTimeDays: 10,
        notes: 'Demo supplier created by the seed.',
      },
    });
  }
  await db.product.updateMany({
    where: {
      storeId,
      supplierId: null,
      title: { in: ['Everyday Cotton Tee', 'Linen Summer Shirt', 'Merino Beanie'] },
    },
    data: { supplierId: supplier.id },
  });

  // Colour options shown as swatches.
  const swatches: Record<string, Record<string, string>> = {
    'Everyday Cotton Tee': { Blue: '#2563eb', Black: '#18181b' },
    'Merino Beanie': { Plum: '#6b2d5c', Charcoal: '#36454f' },
  };
  for (const [title, colors] of Object.entries(swatches)) {
    const p = await product(title);
    if (!p) continue;
    const option = await db.productOption.findFirst({
      where: { productId: p.id, name: 'Color', style: 'buttons' },
    });
    if (!option) continue;
    await db.productOption.update({
      where: { id: option.id },
      data: { style: 'swatches', swatches: option.values.map((v) => colors[v] ?? '') },
    });
  }

  // Personalisation on the weekender bag.
  const bag = await product('Canvas Weekender Bag');
  if (bag && Array.isArray(bag.customizations) && bag.customizations.length === 0) {
    await db.product.update({
      where: { id: bag.id },
      data: {
        customizations: [
          {
            id: randomUUID(),
            type: 'text',
            label: 'Monogram',
            required: false,
            helpText: 'Up to 3 letters, stitched on the front pocket.',
            price: 800,
            maxLength: 3,
            choices: [],
          },
          {
            id: randomUUID(),
            type: 'checkbox',
            label: 'Gift wrap',
            required: false,
            helpText: 'Wrapped in recycled paper with a card.',
            price: 500,
            maxLength: 0,
            choices: [],
          },
        ],
      },
    });
  }

  // A bundle of three existing products.
  if (!(await product('Weekend Getaway Set'))) {
    const parts = await db.productVariant.findMany({
      where: {
        storeId,
        OR: [
          { product: { title: 'Canvas Weekender Bag' } },
          { product: { title: 'Insulated Water Bottle' }, options: { has: '500 ml' } },
          { product: { title: 'Sunglasses — Classic' } },
        ],
      },
    });
    if (parts.length === 3) {
      const set = await db.product.create({
        data: {
          storeId,
          title: 'Weekend Getaway Set',
          handle: 'weekend-getaway-set',
          description:
            'Everything for a short trip: the canvas weekender, a 500 ml insulated bottle and classic sunglasses.\n\nSold as a set. It ships together and costs less than buying each item.',
          status: 'ACTIVE',
          publishedAt: new Date(),
          vendor: 'Demo Outfitters',
          productType: 'Bundles',
          tags: ['bundle', 'outdoor'],
          isBundle: true,
        },
      });
      const full = parts.reduce((sum, v) => sum + v.price, 0);
      const variant = await db.productVariant.create({
        data: {
          storeId,
          productId: set.id,
          title: 'Default',
          sku: 'SET-WEEKEND',
          price: Math.round((full * 0.85) / 100) * 100,
          weightGrams: parts.reduce((sum, v) => sum + v.weightGrams, 0),
        },
      });
      await db.bundleComponent.createMany({
        data: parts.map((v, position) => ({
          storeId,
          bundleVariantId: variant.id,
          componentVariantId: v.id,
          quantity: 1,
          position,
        })),
      });
      await db.productVariant.update({
        where: { id: variant.id },
        data: bundleStock(parts.map((v) => ({ ...v, quantity: 1 }))),
      });
      const storage = new LocalDiskStorage(process.env.STORAGE_DIR ?? 'storage');
      // The bag's photos (stored as separate copies), the set's main item.
      await seedProductImages(db, storage, storeId, set.id, 'Canvas Weekender Bag', '#0f766e');
    }
  }
}
