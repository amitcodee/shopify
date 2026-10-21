import { formatMoney, type OrderListItem, type Paginated } from '@repo/contracts';
import Link from 'next/link';
import {
  ButtonLink,
  EmptyState,
  formatDateTime,
  PageHeader,
  Pagination,
  Table,
  Td,
} from '@/components/ui';
import { api } from '@/lib/api';
import { FinancialBadge, FulfillmentBadge, OrderStatusBadge } from './badges';

const VIEWS = [
  { key: 'all', label: 'All', query: {} },
  {
    key: 'unfulfilled',
    label: 'Unfulfilled',
    query: { status: 'OPEN', fulfillmentStatus: 'UNFULFILLED' },
  },
  { key: 'unpaid', label: 'Awaiting payment', query: { status: 'PENDING_PAYMENT' } },
  { key: 'cancelled', label: 'Cancelled', query: { status: 'CANCELLED' } },
] as const;

export default async function OrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<{ view?: string; q?: string; page?: string }>;
}) {
  const { storeId } = await params;
  const { view = 'all', q, page } = await searchParams;
  const current = VIEWS.find((v) => v.key === view) ?? VIEWS[0];
  const orders = await api<Paginated<OrderListItem>>(`/admin/stores/${storeId}/orders`, {
    query: { ...current.query, q, page: Number(page) || 1 },
  });
  const base = `/s/${storeId}/orders`;
  const href = (overrides: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries({ view, q, ...overrides }))
      if (v && !(k === 'view' && v === 'all')) sp.set(k, v);
    const qs = sp.toString();
    return qs ? `${base}?${qs}` : base;
  };

  return (
    <>
      <PageHeader
        title="Orders"
        actions={
          <div className="flex items-center gap-4">
            <Link
              href={`${base}/abandoned`}
              className="text-sm text-indigo-600 hover:text-indigo-500"
            >
              Abandoned checkouts
            </Link>
            <ButtonLink href={`${base}/drafts`} variant="secondary">
              Draft orders
            </ButtonLink>
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Order views" className="flex gap-1">
          {VIEWS.map((v) => (
            <Link
              key={v.key}
              href={href({ view: v.key, page: undefined })}
              aria-current={current.key === v.key ? 'page' : undefined}
              className={`rounded-md px-3 py-1.5 text-sm ${current.key === v.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {v.label}
            </Link>
          ))}
        </nav>
        <form action={base} className="flex gap-2">
          {view !== 'all' ? <input type="hidden" name="view" value={view} /> : null}
          <label htmlFor="order-search" className="sr-only">
            Search orders
          </label>
          <input
            id="order-search"
            name="q"
            defaultValue={q}
            placeholder="Order # or email"
            className="w-56 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          />
        </form>
      </div>
      {orders.items.length === 0 ? (
        <EmptyState
          title="No orders yet"
          description="Orders placed on your storefront appear here."
        />
      ) : (
        <>
          <Table head={['Order', 'Date', 'Customer', 'Payment', 'Fulfillment', 'Items', 'Total']}>
            {orders.items.map((o) => (
              <tr key={o.id} className="hover:bg-slate-50">
                <Td>
                  <Link
                    href={`${base}/${o.id}`}
                    className="font-medium text-slate-900 hover:underline"
                  >
                    #{o.number}
                  </Link>{' '}
                  <OrderStatusBadge status={o.status} />
                </Td>
                <Td className="whitespace-nowrap">{formatDateTime(o.createdAt)}</Td>
                <Td>{o.customerName ?? o.email}</Td>
                <Td>
                  <FinancialBadge status={o.financialStatus} />
                </Td>
                <Td>
                  <FulfillmentBadge status={o.fulfillmentStatus} />
                </Td>
                <Td>{o.itemCount}</Td>
                <Td>{formatMoney(o.total, o.currency)}</Td>
              </tr>
            ))}
          </Table>
          <Pagination
            page={orders.page}
            pageSize={orders.pageSize}
            total={orders.total}
            hrefFor={(n) => href({ page: String(n) })}
          />
        </>
      )}
    </>
  );
}
