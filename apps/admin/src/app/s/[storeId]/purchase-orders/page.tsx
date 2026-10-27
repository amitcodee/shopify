import { formatMoney, type Paginated, type PurchaseOrderListItem } from '@repo/contracts';
import Link from 'next/link';
import {
  ButtonLink,
  EmptyState,
  PageHeader,
  Pagination,
  Table,
  Td,
  ViewTabs,
} from '@/components/ui';
import { api } from '@/lib/api';
import { getStore } from '@/lib/session';
import { formatDay, PurchaseOrderStatusBadge, PurchasingTabs } from './shared';

export const metadata = { title: 'Purchase orders · Merchant Admin' };

const VIEWS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ORDERED', label: 'Ordered' },
  { value: 'PARTIALLY_RECEIVED', label: 'Partially received' },
  { value: 'RECEIVED', label: 'Received' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export default async function PurchaseOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const { storeId } = await params;
  const { status = '', page = '1' } = await searchParams;
  const store = await getStore(storeId);
  const view = VIEWS.some((v) => v.value === status) ? status : '';
  const query = new URLSearchParams({ page, pageSize: '25' });
  if (view) query.set('status', view);
  const list = await api<Paginated<PurchaseOrderListItem>>(
    `/admin/stores/${storeId}/purchase-orders?${query}`,
  );
  const canWrite = store.permissions.includes('products:write');
  const href = (next: { status?: string; page?: number }) => {
    const q = new URLSearchParams();
    const s = next.status ?? view;
    if (s) q.set('status', s);
    if (next.page && next.page > 1) q.set('page', String(next.page));
    const text = q.toString();
    return `/s/${storeId}/purchase-orders${text ? `?${text}` : ''}`;
  };

  return (
    <>
      <PageHeader
        title="Purchase orders"
        description="Order stock from suppliers and receive it into a location."
        actions={
          canWrite ? (
            <ButtonLink href={`/s/${storeId}/purchase-orders/new`} icon="plus">
              Create purchase order
            </ButtonLink>
          ) : null
        }
      />
      <PurchasingTabs storeId={storeId} active="orders" />
      <div className="mb-4">
        <ViewTabs
          label="Filter purchase orders"
          items={VIEWS.map((v) => ({
            label: v.label,
            href: href({ status: v.value }),
            active: v.value === view,
          }))}
        />
      </div>
      {list.items.length === 0 ? (
        <EmptyState
          icon="truck"
          title={view ? 'No purchase orders in this view' : 'No purchase orders yet'}
          description="Create a purchase order when you buy stock. Receiving it adds the units to your inventory and keeps a record of what you paid."
          action={
            canWrite && !view ? (
              <ButtonLink href={`/s/${storeId}/purchase-orders/new`} icon="plus">
                Create purchase order
              </ButtonLink>
            ) : null
          }
        />
      ) : (
        <>
          <Table
            head={['Order', 'Supplier', 'Destination', 'Status', 'Expected', 'Received', 'Total']}
            numeric={[5, 6]}
          >
            {list.items.map((o) => (
              <tr key={o.id}>
                <Td>
                  <Link
                    href={`/s/${storeId}/purchase-orders/${o.id}`}
                    className="font-medium text-slate-900 hover:text-indigo-600"
                  >
                    {o.name}
                  </Link>
                </Td>
                <Td>{o.supplierName}</Td>
                <Td className="text-slate-500">{o.locationName}</Td>
                <Td>
                  <PurchaseOrderStatusBadge status={o.status} overdue={o.overdue} />
                </Td>
                <Td className="whitespace-nowrap text-slate-500">
                  {o.expectedAt ? formatDay(o.expectedAt) : '—'}
                </Td>
                <Td numeric>
                  {o.unitsReceived} / {o.unitsOrdered}
                </Td>
                <Td numeric className="font-medium text-slate-900">
                  {formatMoney(o.total, store.currency)}
                </Td>
              </tr>
            ))}
          </Table>
          <Pagination
            page={list.page}
            pageSize={list.pageSize}
            total={list.total}
            hrefFor={(p) => href({ page: p })}
          />
        </>
      )}
    </>
  );
}
