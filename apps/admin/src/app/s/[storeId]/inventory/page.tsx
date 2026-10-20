import {
  type InventoryItem,
  LOW_STOCK_THRESHOLD,
  manualInventoryReasons,
  type Paginated,
} from '@repo/contracts';
import Link from 'next/link';
import { ActionForm, SubmitButton } from '@/components/form';
import { Badge, EmptyState, PageHeader, Pagination, Table, Td } from '@/components/ui';
import { api } from '@/lib/api';
import { getStore } from '@/lib/session';
import { adjustInventoryAction } from './actions';

export default async function InventoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<{ q?: string; lowStock?: string; page?: string }>;
}) {
  const { storeId } = await params;
  const { q, lowStock, page } = await searchParams;
  const store = await getStore(storeId);
  const canWrite = store.permissions.includes('products:write');
  const inventory = await api<Paginated<InventoryItem>>(`/admin/stores/${storeId}/inventory`, {
    query: { q, lowStock, page: Number(page) || 1 },
  });
  const base = `/s/${storeId}/inventory`;

  return (
    <>
      <PageHeader title="Inventory" description="Stock levels for every variant." />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 text-sm">
          <Link
            href={base}
            className={`rounded-md px-3 py-1.5 ${!lowStock ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            All
          </Link>
          <Link
            href={`${base}?lowStock=true`}
            className={`rounded-md px-3 py-1.5 ${lowStock ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            Low stock (≤ {LOW_STOCK_THRESHOLD})
          </Link>
        </div>
        <form action={base} className="flex gap-2">
          <label htmlFor="inv-search" className="sr-only">
            Search inventory
          </label>
          <input
            id="inv-search"
            name="q"
            defaultValue={q}
            placeholder="Search product or SKU"
            className="w-64 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </form>
      </div>

      {inventory.items.length === 0 ? (
        <EmptyState title="No variants found" />
      ) : (
        <>
          <Table head={['Product', 'SKU', 'Available', canWrite ? 'Adjust' : '']}>
            {inventory.items.map((item) => (
              <tr key={item.variantId}>
                <Td>
                  <Link
                    href={`/s/${storeId}/products/${item.productId}`}
                    className="font-medium text-slate-900 hover:underline"
                  >
                    {item.productTitle}
                  </Link>
                  <p className="text-xs text-slate-500">{item.variantTitle}</p>
                </Td>
                <Td>{item.sku ?? '—'}</Td>
                <Td>
                  {item.trackInventory ? (
                    <span className="inline-flex items-center gap-2">
                      {item.inventoryQuantity}
                      {item.inventoryQuantity <= LOW_STOCK_THRESHOLD ? (
                        <Badge tone={item.inventoryQuantity <= 0 ? 'red' : 'yellow'}>
                          {item.inventoryQuantity <= 0 ? 'out' : 'low'}
                        </Badge>
                      ) : null}
                    </span>
                  ) : (
                    <span className="text-slate-400">Not tracked</span>
                  )}
                </Td>
                <Td>
                  {canWrite && item.trackInventory ? (
                    <ActionForm
                      action={adjustInventoryAction.bind(null, storeId, item.variantId)}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <label className="sr-only" htmlFor={`d-${item.variantId}`}>
                        Change for {item.productTitle} {item.variantTitle}
                      </label>
                      <input
                        id={`d-${item.variantId}`}
                        name="delta"
                        inputMode="numeric"
                        placeholder="+10 / -2"
                        required
                        pattern="-?[0-9]+"
                        className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      />
                      <label className="sr-only" htmlFor={`r-${item.variantId}`}>
                        Reason
                      </label>
                      <select
                        id={`r-${item.variantId}`}
                        name="reason"
                        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      >
                        {manualInventoryReasons.map((reason) => (
                          <option key={reason} value={reason}>
                            {reason.toLowerCase()}
                          </option>
                        ))}
                      </select>
                      <SubmitButton variant="secondary">Apply</SubmitButton>
                    </ActionForm>
                  ) : null}
                </Td>
              </tr>
            ))}
          </Table>
          <Pagination
            page={inventory.page}
            pageSize={inventory.pageSize}
            total={inventory.total}
            hrefFor={(n) =>
              `${base}?${new URLSearchParams({ ...(q ? { q } : {}), ...(lowStock ? { lowStock } : {}), page: String(n) })}`
            }
          />
        </>
      )}
    </>
  );
}
