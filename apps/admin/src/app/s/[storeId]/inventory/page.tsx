import {
  type InventoryItem,
  type Location,
  LOW_STOCK_THRESHOLD,
  manualInventoryReasons,
  type Paginated,
} from '@repo/contracts';
import Link from 'next/link';
import { ActionForm, SubmitButton } from '@/components/form';
import {
  Badge,
  EmptyState,
  inputClass,
  PageHeader,
  Pagination,
  SearchInput,
  Table,
  Td,
  ViewTabs,
} from '@/components/ui';
import { api } from '@/lib/api';
import { getStore } from '@/lib/session';
import { adjustInventoryAction, transferInventoryAction } from './actions';

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
  const [inventory, locations] = await Promise.all([
    api<Paginated<InventoryItem>>(`/admin/stores/${storeId}/inventory`, {
      query: { q, lowStock, page: Number(page) || 1 },
    }),
    api<Location[]>(`/admin/stores/${storeId}/locations`),
  ]);
  const multiLocation = locations.length > 1;
  const locationName = new Map(locations.map((l) => [l.id, l.name]));
  const base = `/s/${storeId}/inventory`;

  return (
    <>
      <PageHeader title="Inventory" description="Stock levels for every variant." />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <ViewTabs
          label="Stock filter"
          items={[
            { label: 'All', href: base, active: !lowStock },
            {
              label: `Low stock (≤ ${LOW_STOCK_THRESHOLD})`,
              href: `${base}?lowStock=true`,
              active: Boolean(lowStock),
            },
          ]}
        />
        <form action={base} className="w-full sm:w-auto">
          <SearchInput
            id="inv-search"
            label="Search inventory"
            defaultValue={q}
            placeholder="Search product or SKU"
          />
        </form>
      </div>

      {inventory.items.length === 0 ? (
        <EmptyState
          icon="inventory"
          title="No variants found"
          description={lowStock ? 'Nothing is running low right now.' : 'Try a different search.'}
        />
      ) : (
        <>
          <Table head={['Product', 'SKU', 'Available', canWrite ? 'Adjust' : '']}>
            {inventory.items.map((item) => (
              <tr key={item.variantId}>
                <Td>
                  <Link
                    href={`/s/${storeId}/products/${item.productId}`}
                    className="font-medium text-slate-900 hover:text-indigo-600"
                  >
                    {item.productTitle}
                  </Link>
                  <p className="text-xs text-slate-500">{item.variantTitle}</p>
                </Td>
                <Td className="font-mono text-xs whitespace-nowrap text-slate-500">
                  {item.sku ?? '—'}
                </Td>
                <Td>
                  {item.trackInventory ? (
                    <span className="inline-flex items-center gap-2 font-medium text-slate-900 tabular-nums">
                      {item.inventoryQuantity}
                      {item.inventoryQuantity <= LOW_STOCK_THRESHOLD ? (
                        <Badge tone={item.inventoryQuantity <= 0 ? 'red' : 'yellow'}>
                          {item.inventoryQuantity <= 0 ? 'Out' : 'Low'}
                        </Badge>
                      ) : null}
                    </span>
                  ) : (
                    <span className="text-slate-400">Not tracked</span>
                  )}
                  {multiLocation && item.trackInventory ? (
                    <p className="mt-1 text-xs text-slate-500">
                      {item.levels
                        .map((l) => `${locationName.get(l.locationId) ?? '?'}: ${l.available}`)
                        .join(' · ')}
                    </p>
                  ) : null}
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
                        className={`${inputClass} h-8 w-24 px-2.5`}
                      />
                      <label className="sr-only" htmlFor={`r-${item.variantId}`}>
                        Reason
                      </label>
                      <select
                        id={`r-${item.variantId}`}
                        name="reason"
                        className={`${inputClass} h-8 w-auto px-2.5`}
                      >
                        {manualInventoryReasons.map((reason) => (
                          <option key={reason} value={reason}>
                            {reason.toLowerCase()}
                          </option>
                        ))}
                      </select>
                      {multiLocation ? (
                        <>
                          <label className="sr-only" htmlFor={`l-${item.variantId}`}>
                            Location for {item.productTitle} {item.variantTitle}
                          </label>
                          <select
                            id={`l-${item.variantId}`}
                            name="locationId"
                            defaultValue={locations.find((l) => l.isDefault)?.id}
                            className={`${inputClass} h-8 w-auto px-2.5`}
                          >
                            {locations.map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.name}
                              </option>
                            ))}
                          </select>
                        </>
                      ) : null}
                      <SubmitButton variant="secondary">Apply</SubmitButton>
                    </ActionForm>
                  ) : null}
                  {canWrite && item.trackInventory && multiLocation ? (
                    <details className="mt-2 text-xs">
                      <summary className="cursor-pointer font-medium text-indigo-600">
                        Move stock
                      </summary>
                      <ActionForm
                        action={transferInventoryAction.bind(null, storeId, item.variantId)}
                        className="mt-2 flex flex-wrap items-center gap-2"
                      >
                        {(['from', 'to'] as const).map((side, i) => (
                          <select
                            key={side}
                            name={side}
                            aria-label={`Move ${side} location for ${item.productTitle} ${item.variantTitle}`}
                            defaultValue={locations[i]?.id}
                            className={`${inputClass} h-8 w-auto px-2.5`}
                          >
                            {locations.map((l) => (
                              <option key={l.id} value={l.id}>
                                {side} {l.name}
                              </option>
                            ))}
                          </select>
                        ))}
                        <input
                          name="quantity"
                          inputMode="numeric"
                          required
                          pattern="[0-9]+"
                          aria-label={`Units to move for ${item.productTitle} ${item.variantTitle}`}
                          placeholder="Qty"
                          className={`${inputClass} h-8 w-20 px-2.5`}
                        />
                        <SubmitButton variant="secondary">Move</SubmitButton>
                      </ActionForm>
                    </details>
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
