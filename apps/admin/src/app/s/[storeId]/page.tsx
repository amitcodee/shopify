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
  type Theme,
} from '@repo/contracts';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { CountUp } from '@/components/count-up';
import { Icon, type IconName } from '@/components/icons';
import { SalesChart } from '@/components/sales-chart';
import { Alert, buttonClass, Card, PageHeader, ViewTabs } from '@/components/ui';
import { api } from '@/lib/api';
import { getStore } from '@/lib/session';
import { storefrontUrlFor } from '@/lib/storefront';
import { TemplateThumbnail } from './settings/theme/template-thumbnail';

/** Change vs the previous period of the same length; null when there is nothing to compare. */
function delta(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return (current - previous) / previous;
}

function Delta({ value, days }: { value: number | null; days: number }) {
  if (value === null) {
    return <span className="text-slate-400">No sales in the previous {days} days</span>;
  }
  const pct = Math.round(value * 1000) / 10;
  const flat = Math.abs(pct) < 0.5;
  const up = pct > 0;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums ${
          flat
            ? 'bg-slate-100 text-slate-600'
            : up
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-red-50 text-red-700'
        }`}
      >
        {flat ? null : (
          <Icon name={up ? 'arrowUp' : 'arrowDown'} className="h-3 w-3" strokeWidth={2.5} />
        )}
        {flat ? '0%' : `${Math.abs(pct)}%`}
        <span className="sr-only">{flat ? 'unchanged' : up ? 'increase' : 'decrease'}</span>
      </span>
      <span className="text-slate-500">vs previous {days} days</span>
    </span>
  );
}

/** A tiny trend line for a stat card (decorative; the numbers carry the meaning). */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2 || values.every((v) => v === 0)) return null;
  const max = Math.max(...values);
  const points = values
    .map((v, i) => `${(i / (values.length - 1)) * 100},${28 - (v / (max || 1)) * 26}`)
    .join(' ');
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden className="h-8 w-24 shrink-0">
      <polyline points={`0,30 ${points} 100,30`} className="fill-indigo-500/10 stroke-none" />
      <polyline
        points={points}
        fill="none"
        className="stroke-indigo-500"
        strokeWidth={1.75}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Stat({
  label,
  value,
  footer,
  href,
  trend,
}: {
  label: string;
  value: ReactNode;
  footer?: ReactNode;
  href?: string;
  trend?: number[];
}) {
  const body = (
    <div className="h-full rounded-xl border border-slate-200/90 bg-white p-4 shadow-card transition-shadow sm:p-5">
      <p className="text-[13px] font-medium text-slate-500">{label}</p>
      <div className="mt-1.5 flex items-end justify-between gap-3">
        <p className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</p>
        {trend ? <Sparkline values={trend} /> : null}
      </div>
      {footer ? <p className="mt-2 text-xs">{footer}</p> : null}
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-xl hover:[&>div]:shadow-raised">
      {body}
    </Link>
  ) : (
    body
  );
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

  const [analytics, doubled, toFulfill, lowStock, payments, products, theme, domains, draft, apps] =
    await Promise.all([
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
  const quickActions: { label: string; icon: IconName; href: string }[] = [];
  if (can('products:write'))
    quickActions.push({ label: 'Add product', icon: 'plus', href: `${base}/products/new` });
  if (can('discounts:write'))
    quickActions.push({ label: 'Create discount', icon: 'discounts', href: `${base}/discounts` });
  if (can('settings:read')) {
    quickActions.push({
      label: 'Customize theme',
      icon: 'palette',
      href: `${base}/settings/theme/editor`,
    });
    quickActions.push({ label: 'Browse apps', icon: 'apps', href: `${base}/apps` });
  }
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
  const topMax = Math.max(1, ...(analytics?.topProducts.map((p) => p.revenue) ?? []));

  return (
    <>
      <PageHeader
        title={`${greeting}, welcome to ${store.name}`}
        description="Here’s how your store is doing."
        actions={
          analytics ? (
            <ViewTabs
              label="Date range"
              items={RANGES.map((r) => ({
                label: `${r} days`,
                href: `${base}?days=${r}`,
                active: r === days,
              }))}
            />
          ) : null
        }
      />

      <div className="space-y-6">
        {quickActions.length > 0 ? (
          <nav aria-label="Quick actions" className="-mt-2 flex flex-wrap gap-2">
            {quickActions.map((a) => (
              <Link key={a.label} href={a.href} className={buttonClass('secondary', 'sm')}>
                <Icon name={a.icon} className="-ml-0.5 h-4 w-4 text-slate-500" />
                {a.label}
              </Link>
            ))}
          </nav>
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
                  className="h-full rounded-full bg-indigo-500"
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

        {analytics ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
            <Stat
              label={`Net sales (${days}d)`}
              value={<CountUp value={analytics.netSales} currency={store.currency} />}
              trend={analytics.daily.map((d) => d.sales)}
              footer={
                previous ? (
                  <Delta value={delta(analytics.netSales, previous.net)} days={days} />
                ) : null
              }
            />
            <Stat
              label="Orders"
              value={<CountUp value={analytics.orderCount} />}
              trend={analytics.daily.map((d) => d.orders)}
              href={`${base}/orders`}
              footer={
                previous ? (
                  <Delta value={delta(analytics.orderCount, previous.orders)} days={days} />
                ) : null
              }
            />
            <Stat
              label="Average order value"
              value={<CountUp value={analytics.averageOrderValue} currency={store.currency} />}
              footer={
                previous ? (
                  <Delta value={delta(analytics.averageOrderValue, prevAov)} days={days} />
                ) : null
              }
            />
            <Stat
              label="Gross sales"
              value={<CountUp value={analytics.grossSales} currency={store.currency} />}
              footer={
                analytics.refunded > 0 ? (
                  <span className="text-slate-500">{money(analytics.refunded)} refunded</span>
                ) : (
                  <span className="text-slate-500">No refunds in this period</span>
                )
              }
            />
          </div>
        ) : null}

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-6">
            {analytics ? (
              <Card
                title="Net sales by day"
                description={
                  analytics.refunded > 0
                    ? `Gross ${money(analytics.grossSales)} · refunded ${money(analytics.refunded)}`
                    : 'Paid orders, by payment date (UTC).'
                }
              >
                <div className="relative pt-3">
                  <SalesChart days={analytics.daily} currency={store.currency} />
                  {analytics.netSales === 0 && analytics.orderCount === 0 ? (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center pb-8">
                      <p className="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm text-slate-500 shadow-xs">
                        No paid orders in the last {days} days yet
                      </p>
                    </div>
                  ) : null}
                </div>
              </Card>
            ) : null}

            {analytics ? (
              <Card title="Top products" description={`By revenue, last ${days} days.`}>
                {analytics.topProducts.length === 0 ? (
                  <p className="text-sm text-slate-500">No sales in this period yet.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="sr-only">
                      <tr>
                        <th scope="col">Product</th>
                        <th scope="col">Units</th>
                        <th scope="col">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.topProducts.map((p, i) => (
                        <tr key={p.title} className="align-top">
                          <td className="py-2 pr-3">
                            <div className="flex items-baseline gap-2">
                              <span className="w-4 shrink-0 text-xs text-slate-400 tabular-nums">
                                {i + 1}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium text-slate-800">{p.title}</p>
                                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100">
                                  <div
                                    className="h-full rounded-full bg-indigo-400"
                                    style={{ width: `${(p.revenue / topMax) * 100}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2 pr-3 text-right whitespace-nowrap text-slate-500 tabular-nums">
                            {p.quantity} sold
                          </td>
                          <td className="py-2 text-right font-medium whitespace-nowrap text-slate-900 tabular-nums">
                            {money(p.revenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            ) : null}
          </div>

          <div className="space-y-6">
            {live ? (
              <section
                aria-labelledby="store-heading"
                className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-card"
              >
                <div className="border-b border-slate-100 bg-slate-50 p-3">
                  <div className="overflow-hidden rounded-lg border border-slate-200 shadow-xs">
                    <TemplateThumbnail
                      photos={template?.industry}
                      preset={live.preset}
                      settings={live.settings}
                      storeName={store.name}
                      heroTitle={live.settings.heroTitle || store.name}
                      announcement={live.settings.announcement}
                      height={150}
                    />
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2 id="store-heading" className="text-[15px] font-semibold text-slate-900">
                      Online store
                    </h2>
                    {draft?.draft ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        Unpublished changes
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                        Live
                      </span>
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
              <Card title="To do" description="Things that need your attention.">
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
              </Card>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
