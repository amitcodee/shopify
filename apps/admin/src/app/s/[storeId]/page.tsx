import {
  type Analytics,
  formatMoney,
  type InventoryItem,
  type OrderListItem,
  type Paginated,
  type PaymentsOverview,
} from '@repo/contracts';
import Link from 'next/link';
import { Icon, type IconName } from '@/components/icons';
import { SalesChart } from '@/components/sales-chart';
import { Alert, Card, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { getStore } from '@/lib/session';

type StatTone = 'neutral' | 'attention' | 'critical';

const STAT_TONES: Record<StatTone, string> = {
  neutral: 'bg-brand-50 text-brand-600 ring-brand-100',
  attention: 'bg-amber-50 text-amber-600 ring-amber-100',
  critical: 'bg-red-50 text-red-600 ring-red-100',
};

function Stat({
  label,
  value,
  href,
  icon,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: number | string;
  href?: string;
  icon: IconName;
  hint?: string;
  tone?: StatTone;
}) {
  const body = (
    <div className="flex h-full flex-col rounded-xl bg-white p-5 shadow-card ring-1 ring-slate-900/[0.06] transition group-hover:shadow-pop group-hover:ring-brand-500/25">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span
          className={`grid size-8 shrink-0 place-items-center rounded-lg ring-1 ring-inset ${STAT_TONES[tone]}`}
        >
          <Icon name={icon} className="size-[18px]" />
        </span>
      </div>
      <p className="tabular mt-3 text-[28px] leading-none font-semibold tracking-tight text-slate-950">
        {value}
      </p>
      {hint || href ? (
        <p className="mt-auto flex items-center justify-between gap-2 pt-3 text-xs text-slate-500">
          <span>{hint}</span>
          {href ? (
            <span
              aria-hidden
              className="font-medium text-brand-600 opacity-0 transition group-hover:opacity-100"
            >
              View →
            </span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
  return href ? (
    <Link href={href} className="group block h-full rounded-xl">
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
  const topRevenue = analytics?.topProducts[0]?.revenue || 1;

  return (
    <>
      <PageHeader
        title={`Welcome to ${store.name}`}
        description={`Here’s how your store is doing over the last ${days} days.`}
        actions={
          analytics ? (
            <nav
              aria-label="Date range"
              className="flex rounded-lg bg-white p-1 shadow-sm ring-1 ring-slate-900/[0.07]"
            >
              {RANGES.map((r) => (
                <Link
                  key={r}
                  href={`${base}?days=${r}`}
                  aria-current={r === days ? 'page' : undefined}
                  className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${r === days ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
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

      <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        {analytics ? (
          <>
            <Stat
              label={`Net sales (${days}d)`}
              value={money(analytics.netSales)}
              icon="discounts"
              hint={
                analytics.refunded > 0 ? `${money(analytics.refunded)} refunded` : 'Paid orders'
              }
            />
            <Stat
              label="Orders"
              value={analytics.orderCount}
              href={`${base}/orders`}
              icon="orders"
              hint={`Last ${days} days`}
            />
            <Stat
              label="Average order value"
              value={money(analytics.averageOrderValue)}
              icon="plans"
              hint="Per paid order"
            />
          </>
        ) : null}
        {toFulfill ? (
          <Stat
            label="To fulfill"
            value={toFulfill.total}
            href={`${base}/orders?view=unfulfilled`}
            icon="inventory"
            tone={toFulfill.total > 0 ? 'attention' : 'neutral'}
            hint={toFulfill.total > 0 ? 'Awaiting shipment' : 'All caught up'}
          />
        ) : null}
        {lowStock ? (
          <Stat
            label="Low-stock variants"
            value={lowStock.total}
            href={`${base}/inventory?lowStock=true`}
            icon="products"
            tone={lowStock.total > 0 ? 'critical' : 'neutral'}
            hint={lowStock.total > 0 ? 'Reorder soon' : 'Stock is healthy'}
          />
        ) : null}
      </div>

      {analytics ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
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
          <Card title="Top products" description="By revenue in this period.">
            {analytics.topProducts.length === 0 ? (
              <div className="py-8 text-center">
                <Icon name="products" className="mx-auto size-8 text-slate-300" />
                <p className="mt-2 text-sm text-slate-500">No sales in this period yet.</p>
              </div>
            ) : (
              <ol className="space-y-4">
                {analytics.topProducts.map((p, index) => (
                  <li key={p.title}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-baseline gap-2">
                        <span className="tabular w-4 shrink-0 text-xs text-slate-400">
                          {index + 1}
                        </span>
                        <span className="truncate font-medium text-slate-900">{p.title}</span>
                      </span>
                      <span className="tabular shrink-0 font-medium text-slate-900">
                        {money(p.revenue)}
                      </span>
                    </div>
                    <div className="mt-1.5 ml-6 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-brand-500"
                          style={{ width: `${Math.max(4, (p.revenue / topRevenue) * 100)}%` }}
                        />
                      </div>
                      <span className="tabular w-16 shrink-0 text-right text-xs text-slate-500">
                        {p.quantity} {p.quantity === 1 ? 'unit' : 'units'}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      ) : null}
    </>
  );
}
