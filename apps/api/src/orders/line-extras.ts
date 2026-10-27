import { parseLineProperties } from '@repo/contracts';

/** Stock taken for one component of a bundle line (OrderLine.components). */
export interface BundleSnapshot {
  variantId: string;
  title: string;
  sku: string | null;
  /** Units per bundle. */
  quantity: number;
  /** Location the units were taken from (where restocks go back to). */
  locationId: string | null;
}

export function parseBundleSnapshot(value: unknown): BundleSnapshot[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item: unknown) => {
    if (typeof item !== 'object' || item === null) return [];
    const c = item as Record<string, unknown>;
    if (typeof c.variantId !== 'string' || typeof c.quantity !== 'number') return [];
    return [
      {
        variantId: c.variantId,
        title: typeof c.title === 'string' ? c.title : '',
        sku: typeof c.sku === 'string' ? c.sku : null,
        quantity: c.quantity,
        locationId: typeof c.locationId === 'string' ? c.locationId : null,
      },
    ];
  });
}

/** The extra fields order line views show: customizations and bundle contents. */
export function lineExtras(line: { properties: unknown; components: unknown }) {
  return {
    properties: parseLineProperties(line.properties),
    components: parseBundleSnapshot(line.components).map((c) => ({
      title: c.title,
      sku: c.sku,
      quantity: c.quantity,
    })),
  };
}
