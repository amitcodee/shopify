import type { ProductCardPage, ProductSort, StorefrontCollection } from '@repo/contracts';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageLinks, ProductGrid } from '@/components/product-grid';
import { isNotFound, sf } from '@/lib/api';
import { getShop } from '@/lib/shop';
import { SortSelect } from './sort-select';

const SORTS: ProductSort[] = ['newest', 'price-asc', 'price-desc', 'title'];

async function getCollection(handle: string): Promise<StorefrontCollection | null> {
  if (handle === 'all') return { title: 'All products', handle: 'all', description: '' };
  try {
    return await sf<StorefrontCollection>(`/collections/${encodeURIComponent(handle)}`);
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const collection = await getCollection((await params).handle);
  return collection
    ? { title: collection.title, description: collection.description || undefined }
    : {};
}

export default async function CollectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ sort?: string; page?: string }>;
}) {
  const { handle } = await params;
  const { sort: rawSort, page: rawPage } = await searchParams;
  const sort = SORTS.includes(rawSort as ProductSort) ? (rawSort as ProductSort) : 'newest';
  const page = Math.max(1, Number(rawPage) || 1);

  const [shop, collection] = await Promise.all([getShop(), getCollection(handle)]);
  if (!shop || !collection) notFound();
  const products = await sf<ProductCardPage>('/products', {
    query: { collection: handle === 'all' ? undefined : handle, sort, page },
  });

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{collection.title}</h1>
          {collection.description ? (
            <p className="mt-2 max-w-2xl text-zinc-600">{collection.description}</p>
          ) : null}
        </div>
        <SortSelect value={sort} />
      </div>
      <ProductGrid products={products.items} currency={shop.currency} theme={shop.theme.settings} />
      <PageLinks
        page={products.page}
        pageSize={products.pageSize}
        total={products.total}
        hrefFor={(p) => `/collections/${handle}?sort=${sort}&page=${p}`}
      />
    </>
  );
}
