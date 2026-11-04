import {
  type Analytics,
  type Domain,
  findThemeTemplate,
  formatMoney,
  parseStoreApps,
  parseTheme,
  STORE_APP_CATALOG,
  type StoreApps,
  type ThemeDraft,
  type InventoryItem,
  type OrderListItem,
  type Paginated,
  type PaymentsOverview,
  type ProductListItem,
  type StaffList,
  type StoreOverview as StoreCard,
  type Theme,
} from '@repo/contracts';
import Link from 'next/link';
import { CountUp } from '@/components/count-up';
import { AvatarStack, DashPanel, KpiCard, TrendPill } from '@/components/dash';
import { OrderHeatmap, ShareGauge, shareColor, WeekdayBars } from '@/components/dash-charts';
import { Icon, type IconName } from '@/components/icons';
import { SalesTrend } from '@/components/sales-trend';
import { Alert, Badge, buttonClass, PageHeader, ViewTabs } from '@/components/ui';
import { api } from '@/lib/api';
import { getStore } from '@/lib/session';
import { storefrontUrlFor } from '@/lib/storefront';
import { StorePreview } from '../../stores/store-preview';

/** Change vs the previous period of the same length; null when there is nothing to compare. */
function delta(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return (current - previous) / previous;
}

function Compare({ value, days }: { value: number | null; days: number }) {
  if (value === null) return <>No sales in the previous {days} days</>;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <TrendPill value={value} />
      vs previous {days} days
    </span>
  );
}

/** `PARTIALLY_REFUNDED` reads as "Partially refunded". */
function statusWord(status: string): string {
  const words = status.toLowerCase().replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** "5 minutes ago" for recent orders. */
function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (seconds < 3600) return rtf.format(-Math.max(1, Math.round(seconds / 60)), 'minute');
  if (seconds < 86_400) return rtf.format(-Math.round(seconds / 3600), 'hour');
  return rtf.format(-Math.round(seconds / 86_400), 'day');
}

function TodoRow({
  href,
  icon,
  tone,
  title,
  detail,
}: {
  href: string;
  icon: IconName;
  tone: 'amber' | 'red' | 'indigo';
  title: string;
  detail: string;
}) {
  const tones = {
    amber: 'bg-amber-50 text-amber-600 ring-amber-600/15',
    red: 'bg-red-50 text-red-600 ring-red-600/15',
    indigo: 'bg-indigo-50 text-indigo-600 ring-indigo-600/15',
  };
  return (
    <li>
      <Link
        href={href}
        className="group flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-slate-50"
      >
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ${tones[tone]}`}
        >
          <Icon name={icon} className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-slate-900">{title}</span>
          <span className="block text-xs text-slate-500">{detail}</span>
        </span>
        <Icon
          name="chevronRight"
          className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500"
        />
      </Link>
    </li>
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

  const [
    analytics,
    doubled,
    toFulfill,
    lowStock,
    payments,
    products,
    theme,
    domains,
    draft,
    apps,
    recentOrders,
    customers,
    staff,
    overview,
  ] = await Promise.all([
    can('analytics:read')
      ? api<Analytics>(`/admin/stores/${storeId}/analytics`, { query: { days } })
      : null,
    // The same metrics over twice the range; subtracting gives the previous period exactly.
    can('analytics:read')
      ? api<Analytics>(`/admin/stores/${storeId}/analytics`, { query: { days: days * 2 } })
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
    can('products:read')
      ? api<Paginated<ProductListItem>>(`/admin/stores/${storeId}/products`, {
          query: { pageSize: 1 },
        })
      : null,
    can('settings:read') ? api<Theme>(`/admin/stores/${storeId}/theme`) : null,
    can('settings:read') ? api<Domain[]>(`/admin/stores/${storeId}/domains`) : null,
    can('settings:read')
      ? api<{ draft: ThemeDraft | null }>(`/admin/stores/${storeId}/theme/draft`)
      : null,
    can('settings:read') ? api<StoreApps>(`/admin/stores/${storeId}/apps`) : null,
    can('orders:read')
      ? api<Paginated<OrderListItem>>(`/admin/stores/${storeId}/orders`, {
          query: { pageSize: 4 },
        })
      : null,
    can('customers:read')
      ? api<Paginated<unknown>>(`/admin/stores/${storeId}/customers`, { query: { pageSize: 1 } })
      : null,
    can('settings:read') ? api<StaffList>(`/admin/stores/${storeId}/staff`) : null,
    can('settings:read') ? api<StoreCard[]>('/admin/stores/overview') : null,
  ]);
  const live = theme ? parseTheme(theme.preset, theme.settings) : null;
  const template = live ? findThemeTemplate(live.settings.template) : undefined;
  const appsOn = apps ? STORE_APP_CATALOG.filter((a) => parseStoreApps(apps)[a.id].enabled) : [];
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: store.timezone })
      .formatToParts(new Date())
      .find((p) => p.type === 'hour')?.value ?? 12,
  );
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const money = (n: number) => formatMoney(n, store.currency);

  const previous =
    analytics && doubled
      ? {
          net: doubled.netSales - analytics.netSales,
          gross: doubled.grossSales - analytics.grossSales,
          orders: doubled.orderCount - analytics.orderCount,
          refunded: doubled.refunded - analytics.refunded,
        }
      : null;
  const prevAov = previous && previous.orders > 0 ? previous.gross / previous.orders : 0;

  // Getting started: only steps we can check from real data, and only for people who can act.
  const steps =
    products && payments && theme && domains
      ? [
          {
            done: products.total > 0,
            title: 'Add your first product',
            detail: 'Photos, prices and stock for what you sell.',
            href: `${base}/products/new`,
            cta: 'Add product',
          },
          {
            done: payments.acceptingPayments,
            title: 'Turn on payments',
            detail: 'Connect a payment provider so customers can check out.',
            href: `${base}/settings/payments`,
            cta: 'Set up',
          },
          {
            done: Boolean(theme.settings.template),
            title: 'Pick a storefront template',
            detail: 'Start from a design made for your industry.',
            href: `${base}/settings/theme`,
            cta: 'Browse',
          },
          {
            done: domains.some((d) => d.verified),
            title: 'Connect a domain',
            detail: 'Use your own web address instead of the free one.',
            href: `${base}/settings/domains`,
            cta: 'Add domain',
          },
        ]
      : [];
  const doneCount = steps.filter((s) => s.done).length;
  const showSetup = steps.length > 0 && doneCount < steps.length;

  const todos = [
    toFulfill && toFulfill.total > 0
      ? {
          key: 'fulfill',
          href: `${base}/orders?view=unfulfilled`,
          icon: 'truck' as const,
          tone: 'amber' as const,
          title: `${toFulfill.total} ${toFulfill.total === 1 ? 'order' : 'orders'} to fulfill`,
          detail: 'Paid and waiting to ship',
        }
      : null,
    lowStock && lowStock.total > 0
      ? {
          key: 'stock',
          href: `${base}/inventory?lowStock=true`,
          icon: 'inventory' as const,
          tone: 'amber' as const,
          title: `${lowStock.total} low-stock ${lowStock.total === 1 ? 'variant' : 'variants'}`,
          detail: 'Restock before they sell out',
        }
      : null,
    payments && payments.openDisputes > 0
      ? {
          key: 'disputes',
          href: `${base}/settings/payments`,
          icon: 'alert' as const,
          tone: 'red' as const,
          title: `${payments.openDisputes} open ${payments.openDisputes === 1 ? 'dispute' : 'disputes'}`,
          detail: 'Respond before the deadline',
        }
      : null,
  ].filter((t) => t !== null);
  const top = analytics?.topProducts ?? [];
  const topRevenue = top.reduce((sum, p) => sum + p.revenue, 0);
  const topUnits = top.reduce((sum, p) => sum + p.quantity, 0);
  // The doubled range starts one period earlier, so its first days line up with this period's.
  const previousDays = analytics && doubled ? doubled.daily.slice(0, analytics.daily.length) : [];
  // Fewer than five means the list is every product sold, so it can speak for all sales.
  const allSold = top.length < 5;
  const storePhotos = overview?.find((s) => s.id === storeId)?.photos ?? [];
  const tests = analytics?.testOrderCount ?? 0;
  const team = staff?.members ?? [];

  return (
    <>
      <PageHeader
        title={`${greeting}, welcome to ${store.name}`}
        description="Here’s how your store is doing."
        actions={
          <>
            {team.length > 0 ? (
              <Link
                href={`${base}/settings/staff`}
                aria-label={`Team: ${team.length} ${team.length === 1 ? 'person' : 'people'}`}
                className="mr-1 rounded-full"
              >
                <AvatarStack
                  names={team.slice(0, 4).map((m) => m.name)}
                  extra={Math.max(0, team.length - 4)}
                />
              </Link>
            ) : null}
            {analytics ? (
              <ViewTabs
                label="Date range"
                items={RANGES.map((r) => ({
                  label: `${r} days`,
                  href: `${base}?days=${r}`,
                  active: r === days,
                }))}
              />
            ) : null}
            {can('settings:read') ? (
              <Link href={`${base}/settings/theme/editor`} className={buttonClass('secondary')}>
                <Icon name="palette" className="-ml-0.5 h-4 w-4 text-slate-500" />
                Customize theme
              </Link>
            ) : null}
            {can('products:write') ? (
              <Link href={`${base}/products/new`} className={buttonClass('primary')}>
                <Icon name="plus" className="-ml-0.5 h-4 w-4" strokeWidth={2} />
                Add product
              </Link>
            ) : null}
          </>
        }
      />

      <div className="space-y-4">
        {analytics && tests > 0 ? (
          <Alert tone="info">
            {tests === analytics.orderCount
              ? `All ${tests === 1 ? '1 order' : `${tests} orders`} in the last ${days} days ${tests === 1 ? 'was a test order' : 'were test orders'}`
              : `${tests} of ${analytics.orderCount} orders in the last ${days} days ${tests === 1 ? 'was a test order' : 'were test orders'}`}{' '}
            paid through the sandbox, so no real money moved. They are counted in the numbers below.
          </Alert>
        ) : null}
        {payments && payments.openDisputes > 0 ? (
          <Alert tone="error">
            {payments.openDisputes === 1
              ? 'A customer disputed a payment.'
              : `${payments.openDisputes} payments are disputed.`}{' '}
            <Link className="font-medium underline" href={`${base}/settings/payments`}>
              Review chargebacks
            </Link>
          </Alert>
        ) : null}
        {payments && !payments.acceptingPayments ? (
          <Alert tone="warning">
            Your store can&apos;t accept orders yet.{' '}
            <Link className="font-medium underline" href={`${base}/settings/payments`}>
              Set up payments
            </Link>{' '}
            to start selling.
          </Alert>
        ) : null}

        {showSetup ? (
          <section
            aria-labelledby="setup-heading"
            className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-card"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-3">
              <div>
                <h2 id="setup-heading" className="text-[15px] font-semibold text-slate-900">
                  Get your store ready
                </h2>
                <p className="mt-0.5 text-[13px] text-slate-500">
                  {doneCount} of {steps.length} steps done
                </p>
              </div>
              <div
                className="h-1.5 w-40 overflow-hidden rounded-full bg-slate-100"
                role="progressbar"
                aria-label="Setup progress"
                aria-valuemin={0}
                aria-valuemax={steps.length}
                aria-valuenow={doneCount}
              >
                <div
                  className="h-full rounded-full bg-slate-900"
                  style={{ width: `${(doneCount / steps.length) * 100}%` }}
                />
              </div>
            </div>
            <ol className="divide-y divide-slate-100 border-t border-slate-100">
              {steps.map((step) => (
                <li key={step.title} className="flex items-center gap-3 px-5 py-3">
                  {step.done ? (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white">
                      <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3} />
                      <span className="sr-only">Done:</span>
                    </span>
                  ) : (
                    <span className="h-6 w-6 shrink-0 rounded-full border-[1.5px] border-dashed border-slate-300" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-medium ${step.done ? 'text-slate-400 line-through decoration-slate-300' : 'text-slate-900'}`}
                    >
                      {step.title}
                    </p>
                    {step.done ? null : <p className="text-[13px] text-slate-500">{step.detail}</p>}
                  </div>
                  {step.done ? null : (
                    <Link href={step.href} className={buttonClass('secondary', 'sm')}>
                      {step.cta}
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {analytics || customers ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {analytics ? (
              <>
                <KpiCard
                  icon="discounts"
                  label={`Net sales (${days}d)`}
                  value={<CountUp value={analytics.netSales} currency={store.currency} />}
                  footer={
                    previous ? (
                      <Compare value={delta(analytics.netSales, previous.net)} days={days} />
                    ) : null
                  }
                />
                <KpiCard
                  icon="orders"
                  label="Orders"
                  value={<CountUp value={analytics.orderCount} />}
                  unit={analytics.orderCount === 1 ? 'Order' : 'Orders'}
                  href={`${base}/orders`}
                  footer={
                    previous ? (
                      <Compare value={delta(analytics.orderCount, previous.orders)} days={days} />
                    ) : null
                  }
                />
              </>
            ) : null}
            {customers ? (
              <KpiCard
                icon="customers"
                label="Customers"
                value={<CountUp value={customers.total} />}
                unit={customers.total === 1 ? 'Person' : 'People'}
                href={`${base}/customers`}
                footer="All time"
              />
            ) : null}
            {analytics ? (
              <KpiCard
                icon="card"
                label="Average order value"
                value={<CountUp value={analytics.averageOrderValue} currency={store.currency} />}
                footer={
                  previous ? (
                    <Compare value={delta(analytics.averageOrderValue, prevAov)} days={days} />
                  ) : null
                }
              />
            ) : null}
          </div>
        ) : null}

        {analytics ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
            <DashPanel
              icon="products"
              title="Top products"
              href={can('products:read') ? `${base}/products` : undefined}
              hrefLabel="Open products"
            >
              {top.length === 0 ? (
                <div className="flex flex-1 flex-col justify-center">
                  <ShareGauge shares={[]} total="0" label="Units sold" />
                  <p className="mt-4 text-center text-sm text-slate-500">
                    No sales in this period yet.
                  </p>
                </div>
              ) : (
                <>
                  <ShareGauge
                    shares={top.map((p) => p.revenue)}
                    total={topUnits.toLocaleString('en-US')}
                    label={allSold ? 'Units sold' : `Units, top ${top.length}`}
                  />
                  <ul className="mt-5 space-y-3.5">
                    {top.slice(0, 4).map((p, i) => (
                      <li key={p.title} className="flex items-start gap-2.5">
                        <span
                          aria-hidden
                          className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                          style={{ background: shareColor(i) }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">{p.title}</p>
                          <p className="text-xs text-slate-500 tabular-nums">
                            {p.quantity} sold ·{' '}
                            {topRevenue > 0 ? Math.round((p.revenue / topRevenue) * 100) : 0}%{' '}
                            {allSold ? 'of product sales' : `of top ${top.length}`}
                          </p>
                        </div>
                        <p className="text-sm font-semibold whitespace-nowrap text-slate-900 tabular-nums">
                          {money(p.revenue)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </DashPanel>

            <DashPanel
              icon="chart"
              title="Sales"
              href={can('orders:read') ? `${base}/orders` : undefined}
              hrefLabel="Open orders"
            >
              <div className="flex flex-wrap items-center gap-2.5">
                <p className="text-[26px] leading-8 font-semibold tracking-tight text-slate-900 tabular-nums">
                  {money(analytics.grossSales)}
                </p>
                {previous && delta(analytics.grossSales, previous.gross) !== null ? (
                  <TrendPill value={delta(analytics.grossSales, previous.gross) ?? 0} />
                ) : null}
              </div>
              <div className="mt-3 mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-slate-600">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className="h-0.5 w-3.5 rounded-full"
                      style={{ background: 'var(--chart-current)' }}
                    />
                    Last {days} days
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className="w-3.5 border-t-2 border-dashed"
                      style={{ borderColor: 'var(--chart-previous)' }}
                    />
                    Previous {days} days
                  </span>
                </div>
                <span>
                  Refunded{' '}
                  <span className="font-medium text-slate-900 tabular-nums">
                    {money(analytics.refunded)}
                  </span>{' '}
                  · Net{' '}
                  <span className="font-medium text-slate-900 tabular-nums">
                    {money(analytics.netSales)}
                  </span>
                </span>
              </div>
              <div className="relative">
                <SalesTrend
                  current={analytics.daily}
                  previous={previousDays}
                  currency={store.currency}
                />
                {analytics.grossSales === 0 && previous?.gross === 0 ? (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center pb-8">
                    <p className="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm text-slate-500 shadow-xs">
                      No paid orders in the last {days * 2} days yet
                    </p>
                  </div>
                ) : null}
              </div>
            </DashPanel>
          </div>
        ) : null}

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)_minmax(0,1fr)]">
          {recentOrders ? (
            <DashPanel
              icon="orders"
              title="Recent orders"
              href={`${base}/orders`}
              hrefLabel="Open orders"
            >
              {recentOrders.items.length === 0 ? (
                <p className="text-sm text-slate-500">Orders will appear here as they come in.</p>
              ) : (
                <ul className="space-y-1.5">
                  {recentOrders.items.map((order) => (
                    <li key={order.id}>
                      <Link
                        href={`${base}/orders/${order.id}`}
                        className="flex items-center gap-2.5 rounded-lg bg-slate-50 p-2.5 transition-colors hover:bg-slate-100"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-900">
                            #{order.number} · {order.customerName ?? order.email}
                          </span>
                          <span className="block text-xs text-slate-500">
                            {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'} ·{' '}
                            {timeAgo(order.createdAt)}
                          </span>
                          <span className="block text-xs text-slate-500">
                            {statusWord(order.financialStatus)} ·{' '}
                            {statusWord(order.fulfillmentStatus)}
                          </span>
                        </span>
                        <span className="text-sm font-semibold whitespace-nowrap text-slate-900 tabular-nums">
                          {formatMoney(order.total, order.currency)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </DashPanel>
          ) : null}

          {analytics ? (
            <>
              <DashPanel icon="chart" title="Sales by weekday">
                <p className="mb-3 text-xs text-slate-500">
                  Last {days} days, {store.timezone} time.
                </p>
                <WeekdayBars days={analytics.daily} currency={store.currency} />
              </DashPanel>
              <DashPanel icon="calendar" title="Order activity">
                <div className="mb-3 flex items-center gap-2.5">
                  <p className="text-[26px] leading-8 font-semibold tracking-tight text-slate-900 tabular-nums">
                    {analytics.orderCount.toLocaleString('en-US')}
                  </p>
                  <span className="text-sm text-slate-500">
                    {analytics.orderCount === 1 ? 'order' : 'orders'} in {days} days
                  </span>
                </div>
                <OrderHeatmap days={analytics.daily} />
              </DashPanel>
            </>
          ) : null}
        </div>

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          {live ? (
            <section
              aria-labelledby="store-heading"
              className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-card"
            >
              <div className="border-b border-slate-100 bg-slate-50 p-3">
                <div>
                  <StorePreview
                    store={{ name: store.name, theme: live, photos: storePhotos }}
                    address={storefrontUrlFor(store.subdomain)}
                  />
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 id="store-heading" className="text-[15px] font-semibold text-slate-900">
                    Online store
                  </h2>
                  {draft?.draft ? (
                    <Badge tone="yellow">Unpublished changes</Badge>
                  ) : (
                    <Badge tone="green">Live</Badge>
                  )}
                </div>
                <p className="mt-0.5 text-[13px] text-slate-500">
                  {template ? `${template.name} · ${template.styleLabel}` : 'Custom theme'}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`${base}/settings/theme/editor`}
                    className={buttonClass('primary', 'sm')}
                  >
                    Customize
                  </Link>
                  <a
                    href={storefrontUrlFor(store.subdomain)}
                    target="_blank"
                    rel="noreferrer"
                    className={buttonClass('secondary', 'sm')}
                  >
                    View store
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </div>
                {apps ? (
                  <Link
                    href={`${base}/apps`}
                    className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5 text-sm hover:bg-slate-100"
                  >
                    <span className="flex items-center gap-2 text-slate-700">
                      <Icon name="apps" className="h-4 w-4 text-slate-500" />
                      {appsOn.length === 0
                        ? 'No apps turned on yet'
                        : `${appsOn.length} ${appsOn.length === 1 ? 'app' : 'apps'} on`}
                    </span>
                    <Icon name="chevronRight" className="h-4 w-4 text-slate-400" />
                  </Link>
                ) : null}
              </div>
            </section>
          ) : null}
          {toFulfill || lowStock || payments ? (
            <DashPanel icon="checkCircle" title="To do">
              {todos.length === 0 ? (
                <div className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-600">
                  <Icon name="checkCircle" className="h-5 w-5 text-emerald-500" />
                  You’re all caught up.
                </div>
              ) : (
                <ul className="-mx-2 -mb-2">
                  {todos.map((t) => (
                    <TodoRow
                      key={t.key}
                      href={t.href}
                      icon={t.icon}
                      tone={t.tone}
                      title={t.title}
                      detail={t.detail}
                    />
                  ))}
                </ul>
              )}
            </DashPanel>
          ) : null}
        </div>
      </div>
    </>
  );
}
