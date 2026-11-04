/**
 * Sample shop content for template previews only: three category names and one product per
 * photo in public/media/templates/<industry>/p1–p4.webp (names match what each photo shows).
 */
export interface SampleProduct {
  name: string;
  price: number;
}

export const TEMPLATE_SAMPLES: Record<
  string,
  { categories: readonly [string, string, string]; products: readonly SampleProduct[] }
> = {
  art: {
    categories: ['Prints', 'Originals', 'Ceramics'],
    products: [
      { name: 'Valley landscape print', price: 48 },
      { name: 'Abstract canvas', price: 120 },
      { name: 'Floral still life', price: 85 },
      { name: 'Stoneware vase', price: 64 },
    ],
  },
  beauty: {
    categories: ['Skincare', 'Makeup', 'Gift sets'],
    products: [
      { name: 'Botanical face oil', price: 38 },
      { name: 'Hydrating cream', price: 32 },
      { name: 'Daily ritual set', price: 76 },
      { name: 'Overnight serum', price: 44 },
    ],
  },
  books: {
    categories: ['Fiction', 'Journals', 'Stationery'],
    products: [
      { name: 'Classic hardbacks', price: 28 },
      { name: 'Travel journal', price: 22 },
      { name: 'Collected poems', price: 18 },
      { name: 'Notebook stack', price: 24 },
    ],
  },
  electronics: {
    categories: ['Audio', 'Wearables', 'Desk setup'],
    products: [
      { name: 'Wireless headphones', price: 149 },
      { name: 'Smart watch', price: 199 },
      { name: 'Portable speaker', price: 79 },
      { name: 'Mechanical keyboard', price: 129 },
    ],
  },
  fashion: {
    categories: ['Women', 'Men', 'Accessories'],
    products: [
      { name: 'Autumn layers set', price: 89 },
      { name: 'Cable-knit sweater', price: 72 },
      { name: 'Denim jacket', price: 98 },
      { name: 'Wool beanie', price: 28 },
    ],
  },
  food: {
    categories: ['Bakery', 'Pantry', 'Coffee'],
    products: [
      { name: 'Wildflower honey', price: 14 },
      { name: 'House blend coffee', price: 16 },
      { name: 'Sourdough loaf', price: 8 },
      { name: 'Whole bean roast', price: 18 },
    ],
  },
  home: {
    categories: ['Decor', 'Lighting', 'Plants'],
    products: [
      { name: 'Ceramic vase', price: 58 },
      { name: 'Glazed bud vase', price: 34 },
      { name: 'Wooden planter', price: 42 },
      { name: 'Table lamp', price: 96 },
    ],
  },
  jewelry: {
    categories: ['Rings', 'Necklaces', 'Earrings'],
    products: [
      { name: 'Gold knot earrings', price: 120 },
      { name: 'Pavé ring set', price: 640 },
      { name: 'Stacking rings', price: 180 },
      { name: 'Teal drop pendant', price: 210 },
    ],
  },
  kids: {
    categories: ['Toys', 'Learning', 'Gifts'],
    products: [
      { name: 'Shape sorter', price: 24 },
      { name: 'Wooden car set', price: 32 },
      { name: 'Push-along truck', price: 45 },
      { name: 'Alphabet blocks', price: 26 },
    ],
  },
  pets: {
    categories: ['Dogs', 'Cats', 'Treats'],
    products: [
      { name: 'Bone biscuits', price: 12 },
      { name: 'Squeaky ball', price: 9 },
      { name: 'Cozy bolster bed', price: 68 },
      { name: 'Rope plush toy', price: 14 },
    ],
  },
  sports: {
    categories: ['Training', 'Yoga', 'Cycling'],
    products: [
      { name: 'Resistance kit', price: 39 },
      { name: 'Hex dumbbells', price: 54 },
      { name: 'Cork yoga blocks', price: 22 },
      { name: 'Home studio set', price: 69 },
    ],
  },
  wellness: {
    categories: ['Self-care', 'Home spa', 'Aromatherapy'],
    products: [
      { name: 'Reed diffuser', price: 32 },
      { name: 'Soy candle', price: 26 },
      { name: 'Apothecary oils', price: 36 },
      { name: 'Aroma diffuser', price: 49 },
    ],
  },
};

/** Sample product `n` (1–4, wrapping) for an industry, matching `productPhoto(industry, n)`. */
export function sampleProduct(industry: string, n: number): SampleProduct {
  const list = TEMPLATE_SAMPLES[industry]?.products ?? [{ name: 'Product', price: 40 }];
  return list[(((n - 1) % list.length) + list.length) % list.length]!;
}

export function sampleCategories(industry: string): readonly string[] {
  return TEMPLATE_SAMPLES[industry]?.categories ?? ['New in', 'Bestsellers', 'Gifts'];
}
