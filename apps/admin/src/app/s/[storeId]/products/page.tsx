import type { Collection, Paginated, ProductListItem, Supplier } from '@repo/contracts';
import Link from 'next/link';
import { Icon } from '@/components/icons';
import {
  ButtonLink,
  buttonClass,
  EmptyState,
  formatDateTime,
  inputClass,
  PageHeader,
  Pagination,
  SearchInput,
  ViewTabs,
} from '@/components/ui';
import { api } from '@/lib/api';
import { getStore } from '@/lib/session';
import { bulkProductsAction } from './actions';
import { ProductsTable } from './products-table';

const FILTERS = [
  { label: 'All', value: undefined },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Archived', value: 'ARCHIVED' },
] as const;

const SORTS = [
  { value: 'updated-desc', label: 'Recently updated' },
  { value: 'created-desc', label: 'Newest' },
  { value: 'created-asc', label: 'Oldest' },
  { value: 'title-asc', label: 'Title A–Z' },
  { value: 'title-desc', label: 'Title Z–A' },
  { value: 'price-asc', label: 'Lowest price' },
  { value: 'price-desc', label: 'Highest price' },
  { value: 'inventory-asc', label: 'Lowest inventory' },
  { value: 'inventory-desc', label: 'Highest inventory' },
] as const;

type Params = {
  q?: string;
  status?: string;
  vendor?: string;
  productType?: string;
  tag?: string;
  collectionId?: string;
  supplierId?: string;
  sort?: string;
  page?: string;
};

const selectClass = `${inputClass} h-8 py-0 pr-8 text-[13px]`;

export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<Params>;
}) {
  const { storeId } = await params;
  const sp = await searchParams;
  const { q, status, vendor, productType, tag, collectionId, supplierId, page } = sp;
  const sort = SORTS.some((s) => s.value === sp.sort) ? sp.sort! : 'updated-desc';
  const [sortKey, direction] = sort.split('-');
  const store = await getStore(storeId);
  const [products, facets, collections, supplier] = await Promise.all([
    api<Paginated<ProductListItem>>(`/admin/stores/${storeId}/products`, {
      query: {
        q,
        status,
        vendor,
        productType,
        tag,
        collectionId,
        supplierId,
        sort: sortKey,
        direction,
        page: Number(page) || 1,
      },
    }),
    api<{ vendors: string[]; productTypes: string[]; tags: string[] }>(
      `/admin/stores/${storeId}/products/facets`,
    ).catch(() => ({ vendors: [], productTypes: [], tags: [] })),
    api<Collection[]>(`/admin/stores/${storeId}/collections`).catch(() => [] as Collection[]),
    supplierId
      ? api<Supplier>(`/admin/stores/${storeId}/suppliers/${supplierId}`).catch(() => null)
      : null,
  ]);
  const base = `/s/${storeId}/products`;
  const canWrite = store.permissions.includes('products:write');

  const current: Params = {
    q,
    status,
    vendor,
    productType,
    tag,
    collectionId,
    supplierId,
    sort: sort === 'updated-desc' ? undefined : sort,
  };
  const hrefFor = (overrides: Partial<Params>) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...current, ...overrides })) {
      if (value) query.set(key, value);
    }
    const qs = query.toString();
    return qs ? `${base}?${qs}` : base;
  };

  const collectionTitle = collections.find((c) => c.id === collectionId)?.title;
  const chips = [
    vendor
      ? { label: `Vendor: ${vendor}`, href: hrefFor({ vendor: undefined, page: undefined }) }
      : null,
    productType
      ? {
          label: `Type: ${productType}`,
          href: hrefFor({ productType: undefined, page: undefined }),
        }
      : null,
    tag ? { label: `Tag: ${tag}`, href: hrefFor({ tag: undefined, page: undefined }) } : null,
    collectionId
      ? {
          label: `Collection: ${collectionTitle ?? 'Unknown'}`,
          href: hrefFor({ collectionId: undefined, page: undefined }),
        }
      : null,
    supplierId
      ? {
          label: `Supplier: ${supplier?.name ?? 'Unknown'}`,
          href: hrefFor({ supplierId: undefined, page: undefined }),
        }
      : null,
  ].filter((c) => c !== null);
  const filtered = Boolean(q || status || chips.length);

  return (
    <>
      <PageHeader
        title="Products"
        actions={
          <>
            {/* A route handler download, not a page: plain <a>, no client-side navigation. */}
            <a href={`${base}/export`} className={buttonClass('secondary', 'sm')} download>
              <Icon name="download" className="-ml-0.5 h-4 w-4 text-slate-500" />
              Export
            </a>
            {canWrite ? (
              <>
                <Link href={`${base}/import`} className={buttonClass('secondary', 'sm')}>
                  <Icon name="upload" className="-ml-0.5 h-4 w-4 text-slate-500" />
                  Import
                </Link>
                <ButtonLink href={`${base}/new`} size="sm" icon="plus">
                  Add product
                </ButtonLink>
              </>
            ) : null}
          </>
        }
      />

      <div className="mb-3">
        <ViewTabs
          label="Filter by status"
          items={FILTERS.map((f) => ({
            label: f.label,
            href: hrefFor({ status: f.value, page: undefined }),
            active: status === f.value,
          }))}
        />
      </div>

      <form
        action={base}
        className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/90 bg-white p-2.5 shadow-card"
      >
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <SearchInput
          id="product-search"
          label="Search products"
          defaultValue={q}
          placeholder="Search title, vendor, SKU or tag"
          className="w-full min-w-0 sm:w-auto sm:flex-1 sm:basis-56"
        />
        <FilterSelect
          name="vendor"
          label="Vendor"
          any="All vendors"
          value={vendor}
          options={facets.vendors.map((v) => ({ value: v, label: v }))}
        />
        <FilterSelect
          name="productType"
          label="Product type"
          any="All types"
          value={productType}
          options={facets.productTypes.map((v) => ({ value: v, label: v }))}
        />
        <FilterSelect
          name="tag"
          label="Tag"
          any="All tags"
          value={tag}
          options={facets.tags.map((v) => ({ value: v, label: v }))}
        />
        <FilterSelect
          name="collectionId"
          label="Collection"
          any="All collections"
          value={collectionId}
          options={collections.map((c) => ({ value: c.id, label: c.title }))}
        />
        <div className="flex flex-1 items-center gap-2 sm:flex-none">
          <label htmlFor="product-sort" className="sr-only">
            Sort by
          </label>
          <select
            id="product-sort"
            name="sort"
            defaultValue={sort}
            className={`${selectClass} min-w-0 flex-1 sm:flex-none`}
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                Sort: {s.label}
              </option>
            ))}
          </select>
          <button type="submit" className={buttonClass('secondary', 'sm')}>
            Apply
          </button>
        </div>
      </form>

      {chips.length > 0 ? (
        <div className="-mt-1 mb-4 flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <Link
              key={chip.label}
              href={chip.href}
              className="group inline-flex items-center gap-1 rounded-full bg-indigo-50 py-0.5 pr-1.5 pl-2.5 text-xs font-medium text-indigo-800 ring-1 ring-indigo-600/15 ring-inset hover:bg-indigo-100"
            >
              {chip.label}
              <Icon name="close" className="h-3 w-3 text-indigo-500" strokeWidth={2.5} />
              <span className="sr-only">(remove filter)</span>
            </Link>
          ))}
          <Link
            href={hrefFor({
              vendor: undefined,
              productType: undefined,
              tag: undefined,
              collectionId: undefined,
              page: undefined,
            })}
            className="ml-1 text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            Clear all
          </Link>
        </div>
      ) : null}

      <ProductsTable
        items={products.items.map((p) => ({
          ...p,
          scheduledFor: p.scheduled && p.publishedAt ? formatDateTime(p.publishedAt) : null,
        }))}
        currency={store.currency}
        base={base}
        canWrite={canWrite}
        bulk={bulkProductsAction.bind(null, storeId)}
        empty={
          <EmptyState
            icon="products"
            title={filtered ? 'No matching products' : 'Add your first product'}
            description={
              filtered
                ? 'Try a different search or remove a filter.'
                : 'Products you add appear here and, once active, on your storefront.'
            }
            action={
              filtered ? (
                <ButtonLink href={base} variant="secondary">
                  Clear filters
                </ButtonLink>
              ) : canWrite ? (
                <ButtonLink href={`${base}/new`}>Add product</ButtonLink>
              ) : null
            }
          />
        }
      />
      <Pagination
        page={products.page}
        pageSize={products.pageSize}
        total={products.total}
        hrefFor={(n) => hrefFor({ page: String(n) })}
      />
    </>
  );
}

function FilterSelect({
  name,
  label,
  any,
  value,
  options,
}: {
  name: string;
  label: string;
  any: string;
  value?: string;
  options: { value: string; label: string }[];
}) {
  const id = `filter-${name}`;
  const known = !value || options.some((o) => o.value === value);
  return (
    <div className="min-w-0 flex-1 basis-[calc(50%-0.25rem)] sm:flex-none sm:basis-auto">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        name={name}
        defaultValue={value ?? ''}
        className={`${selectClass} w-full sm:w-auto sm:max-w-44 ${value ? 'border-indigo-300 bg-indigo-50/40' : ''}`}
      >
        <option value="">{any}</option>
        {!known && value ? <option value={value}>{value}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
