import { type ProductSort, productSortSchema } from '@repo/contracts';

export type CatalogSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Sort, "in stock only" and page from a listing's query string, with safe defaults. */
export function catalogParams(params: CatalogSearchParams): {
  sort: ProductSort;
  inStock: boolean;
  page: number;
} {
  const sort = productSortSchema.safeParse(first(params.sort));
  return {
    sort: sort.success ? sort.data : 'newest',
    inStock: first(params.inStock) === 'true',
    page: Math.min(1000, Math.max(1, Math.floor(Number(first(params.page))) || 1)),
  };
}

/** A listing URL; defaults (newest, everything, page one) are left out to keep links short. */
export function catalogHref(
  path: string,
  {
    sort,
    inStock,
    page,
    ...rest
  }: { sort: ProductSort; inStock: boolean; page?: number } & Record<
    string,
    string | number | boolean | undefined
  >,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(rest)) {
    if (typeof value === 'string' && value !== '') query.set(key, value);
  }
  if (sort !== 'newest') query.set('sort', sort);
  if (inStock) query.set('inStock', 'true');
  if (page && page > 1) query.set('page', String(page));
  const search = query.toString();
  return search ? `${path}?${search}` : path;
}
