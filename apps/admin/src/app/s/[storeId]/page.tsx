import {
  type Analytics,
  formatMoney,
  type InventoryItem,
  type OrderListItem,
  type Paginated,
  type PaymentsOverview,
} from '@repo/contracts';
import Link from 'next/link';
import { SalesChart } from '@/components/sales-chart';
import { Alert, Card, PageHeader, Table, Td } from '@/components/ui';
import { api } from '@/lib/api';
import { getStore } from '@/lib/session';

function Stat({ label, value, href }: { label: string; value: number | string; href?: string }) {
  const body = (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
  return href ? (
    <Link href={href} className="block hover:opacity-90">
      {body}
    </Link>
  ) : (
    body
  );
}

const RANGES = [7, 30, 90];

export default async function StoreOverview({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<{ days?: string }>;
}) {
  const { storeId } = await params;
  const days = RANGES.includes(Number((await searchParams).days))
    ? Number((await searchParams).days)
    : 30;
  const store = await getStore(storeId);
  const base = `/s/${storeId}`;
  const can = (p: (typeof store.permissions)[number]) => store.permissions.includes(p);

  const [analytics, toFulfill, lowStock, payments] = await Promise.all([
    can('analytics:read')
      ? api<Analytics>(`/admin/stores/${storeId}/analytics`, { query: { days } })
      : null,
    can('orders:read')
      ? api<Paginated<OrderListItem>>(`/admin/stores/${storeId}/orders`, {
          query: { status: 'OPEN', fulfillmentStatus: 'UNFULFILLED', pageSize: 1 },
        })
      : null,
    can('products:read')
      ? api<Paginated<InventoryItem>>(`/admin/stores/${storeId}/inventory`, {
          query: { pageSize: 1, lowStock: 'true' },
        })
      : null,
    can('settings:read') ? api<PaymentsOverview>(`/admin/stores/${storeId}/payments`) : null,
  ]);
  const money = (n: number) => formatMoney(n, store.currency);

  return (
    <>
      <PageHeader
        title={`Welcome to ${store.name}`}
        description="Your store at a glance."
        actions={
          analytics ? (
            <nav aria-label="Date range" className="flex gap-1">
              {RANGES.map((r) => (
                <Link
                  key={r}
                  href={`${base}?days=${r}`}
                  aria-current={r === days ? 'page' : undefined}
                  className={`rounded-md px-3 py-1.5 text-sm ${r === days ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  {r} days
                </Link>
              ))}
            </nav>
          ) : null
        }
      />

      {payments && payments.openDisputes > 0 ? (
        <div className="mb-6">
          <Alert tone="error">
            {payments.openDisputes === 1
              ? 'A customer disputed a payment.'
              : `${payments.openDisputes} payments are disputed.`}{' '}
            <Link className="font-medium underline" href={`${base}/settings/payments`}>
              Review chargebacks
            </Link>
          </Alert>
        </div>
      ) : null}
      {payments && !payments.acceptingPayments ? (
        <div className="mb-6">
          <Alert tone="warning">
            Your store can&apos;t accept orders yet.{' '}
            <Link className="font-medium underline" href={`${base}/settings/payments`}>
              Set up payments
            </Link>{' '}
            to start selling.
          </Alert>
        </div>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {analytics ? (
          <>
            <Stat label={`Net sales (${days}d)`} value={money(analytics.netSales)} />
            <Stat label="Orders" value={analytics.orderCount} href={`${base}/orders`} />
            <Stat label="Average order value" value={money(analytics.averageOrderValue)} />
          </>
        ) : null}
        {toFulfill ? (
          <Stat
            label="To fulfill"
            value={toFulfill.total}
            href={`${base}/orders?view=unfulfilled`}
          />
        ) : null}
        {lowStock ? (
          <Stat
            label="Low-stock variants"
            value={lowStock.total}
            href={`${base}/inventory?lowStock=true`}
          />
        ) : null}
      </div>

      {analytics ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <Card
            title="Net sales by day"
            description={
              analytics.refunded > 0
                ? `Gross ${money(analytics.grossSales)} · refunded ${money(analytics.refunded)}`
                : 'Paid orders, by payment date (UTC).'
            }
          >
            <SalesChart days={analytics.daily} currency={store.currency} />
          </Card>
          <Card title="Top products">
            {analytics.topProducts.length === 0 ? (
              <p className="text-sm text-slate-500">No sales in this period yet.</p>
            ) : (
              <Table head={['Product', 'Units', 'Revenue']}>
                {analytics.topProducts.map((p) => (
                  <tr key={p.title}>
                    <Td>{p.title}</Td>
                    <Td>{p.quantity}</Td>
                    <Td>{money(p.revenue)}</Td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
        </div>
      ) : null}
    </>
  );
}
