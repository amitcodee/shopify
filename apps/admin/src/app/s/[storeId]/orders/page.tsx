import { formatMoney, type OrderListItem, type Paginated } from '@repo/contracts';
import Link from 'next/link';
import { Icon } from '@/components/icons';
import {
  buttonClass,
  ButtonLink,
  EmptyState,
  formatDateTime,
  PageHeader,
  Pagination,
  SearchInput,
  Table,
  Td,
  ViewTabs,
} from '@/components/ui';
import { api } from '@/lib/api';
import { FinancialBadge, FulfillmentBadge, OrderStatusBadge } from './badges';
import { ORDER_VIEWS } from './views';

const VIEWS = ORDER_VIEWS;

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
          <>
            <Link href={`${base}/abandoned`} className={buttonClass('ghost', 'sm')}>
              Abandoned checkouts
            </Link>
            <Link href={`${base}/returns`} className={buttonClass('ghost', 'sm')}>
              Returns
            </Link>
            {/* A route handler download, not a page: plain <a>, no client-side navigation. */}
            <a
              href={href({ page: undefined }).replace(base, `${base}/export`)}
              className={buttonClass('secondary', 'sm')}
              download
            >
              <Icon name="download" className="-ml-0.5 h-4 w-4" />
              Export
            </a>
            <ButtonLink href={`${base}/drafts`} variant="primary" size="sm">
              Draft orders
            </ButtonLink>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <ViewTabs
          label="Order views"
          items={VIEWS.map((v) => ({
            label: v.label,
            href: href({ view: v.key, page: undefined }),
            active: current.key === v.key,
          }))}
        />
        <form action={base} className="w-full sm:w-auto">
          {view !== 'all' ? <input type="hidden" name="view" value={view} /> : null}
          <SearchInput
            id="order-search"
            label="Search orders"
            defaultValue={q}
            placeholder="Order # or email"
          />
        </form>
      </div>
      {orders.items.length === 0 ? (
        <EmptyState
          icon="orders"
          title={q ? 'No matching orders' : 'No orders yet'}
          description={
            q
              ? 'Try a different order number or email.'
              : 'Orders placed on your storefront appear here.'
          }
        />
      ) : (
        <>
          <Table
            head={['Order', 'Date', 'Customer', 'Payment', 'Fulfillment', 'Items', 'Total']}
            numeric={[5, 6]}
          >
            {orders.items.map((o) => (
              <tr key={o.id}>
                <Td className="whitespace-nowrap">
                  <Link
                    href={`${base}/${o.id}`}
                    className="font-semibold text-slate-900 hover:text-indigo-600"
                  >
                    #{o.number}
                  </Link>{' '}
                  <OrderStatusBadge status={o.status} />
                </Td>
                <Td className="whitespace-nowrap text-slate-500">{formatDateTime(o.createdAt)}</Td>
                <Td className="max-w-[220px] truncate">{o.customerName ?? o.email}</Td>
                <Td>
                  <FinancialBadge status={o.financialStatus} />
                </Td>
                <Td>
                  <FulfillmentBadge status={o.fulfillmentStatus} />
                </Td>
                <Td numeric>{o.itemCount}</Td>
                <Td numeric className="font-medium text-slate-900">
                  {formatMoney(o.total, o.currency)}
                </Td>
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
