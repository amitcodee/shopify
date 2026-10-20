import { formatMoney, type Paginated, type ProductListItem } from '@repo/contracts';
import Link from 'next/link';
import { Badge, ButtonLink, EmptyState, PageHeader, Pagination, Table, Td } from '@/components/ui';
import { api } from '@/lib/api';
import { getStore } from '@/lib/session';
import { statusTone } from './status';

const FILTERS = [
  { label: 'All', value: undefined },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Archived', value: 'ARCHIVED' },
] as const;

export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { storeId } = await params;
  const { q, status, page } = await searchParams;
  const store = await getStore(storeId);
  const products = await api<Paginated<ProductListItem>>(`/admin/stores/${storeId}/products`, {
    query: { q, status, page: Number(page) || 1 },
  });
  const base = `/s/${storeId}/products`;
  const canWrite = store.permissions.includes('products:write');

  const hrefFor = (overrides: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { q, status, ...overrides };
    for (const [key, value] of Object.entries(merged)) if (value) sp.set(key, value);
    const qs = sp.toString();
    return qs ? `${base}?${qs}` : base;
  };

  return (
    <>
      <PageHeader
        title="Products"
        actions={canWrite ? <ButtonLink href={`${base}/new`}>Add product</ButtonLink> : null}
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Filter by status" className="flex gap-1">
          {FILTERS.map((f) => (
            <Link
              key={f.label}
              href={hrefFor({ status: f.value, page: undefined })}
              aria-current={status === f.value ? 'page' : undefined}
              className={`rounded-md px-3 py-1.5 text-sm ${
                status === f.value ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {f.label}
            </Link>
          ))}
        </nav>
        <form className="flex gap-2" action={base}>
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <label htmlFor="product-search" className="sr-only">
            Search products
          </label>
          <input
            id="product-search"
            name="q"
            defaultValue={q}
            placeholder="Search title, SKU or tag"
            className="w-64 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </form>
      </div>

      {products.items.length === 0 ? (
        <EmptyState
          title={q || status ? 'No matching products' : 'Add your first product'}
          description="Products you add appear here and, once active, on your storefront."
          action={canWrite && !q ? <ButtonLink href={`${base}/new`}>Add product</ButtonLink> : null}
        />
      ) : (
        <>
          <Table head={['', 'Product', 'Status', 'Inventory', 'Price', 'Variants']}>
            {products.items.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <Td className="w-14">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt="" className="h-10 w-10 rounded object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded bg-slate-100" />
                  )}
                </Td>
                <Td>
                  <Link
                    href={`${base}/${p.id}`}
                    className="font-medium text-slate-900 hover:underline"
                  >
                    {p.title}
                  </Link>
                  {p.vendor ? <p className="text-xs text-slate-500">{p.vendor}</p> : null}
                </Td>
                <Td>
                  <Badge tone={statusTone(p.status)}>{p.status.toLowerCase()}</Badge>
                </Td>
                <Td>{p.totalInventory} in stock</Td>
                <Td>
                  {p.minPrice === p.maxPrice
                    ? formatMoney(p.minPrice, store.currency)
                    : `${formatMoney(p.minPrice, store.currency)} – ${formatMoney(p.maxPrice, store.currency)}`}
                </Td>
                <Td>{p.variantCount}</Td>
              </tr>
            ))}
          </Table>
          <Pagination
            page={products.page}
            pageSize={products.pageSize}
            total={products.total}
            hrefFor={(n) => hrefFor({ page: String(n) })}
          />
        </>
      )}
    </>
  );
}
