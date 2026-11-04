import {
  findThemeTemplate,
  formatMoney,
  type StoreOverview,
  type StoreRole,
} from '@repo/contracts';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AvatarStack, KpiCard } from '@/components/dash';
import { Icon } from '@/components/icons';
import { TopBar } from '@/components/top-bar';
import { Badge, type BadgeTone, ButtonLink, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { getCurrentUser } from '@/lib/session';
import { storefrontUrlFor } from '@/lib/storefront';
import { StorePreview } from './store-preview';
import { StoresBrowser } from './stores-browser';

export const metadata = { title: 'Your stores · Merchant Admin' };

const ROLE_LABELS: Record<StoreRole, string> = { OWNER: 'Owner', ADMIN: 'Admin', STAFF: 'Staff' };

/** A date in the store's own time zone (the zone falls back to UTC if it is not recognised). */
function formatDate(iso: string, timeZone: string): string {
  const options = { day: 'numeric', month: 'short', year: 'numeric' } as const;
  try {
    return new Intl.DateTimeFormat('en-GB', { ...options, timeZone }).format(new Date(iso));
  } catch {
    return new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' }).format(new Date(iso));
  }
}

function timeAgo(iso: string): string {
  const days = Math.max(0, (Date.now() - new Date(iso).getTime()) / 86_400_000);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (days < 1) return 'today';
  if (days < 31) return rtf.format(-Math.round(days), 'day');
  if (days < 365) return rtf.format(-Math.round(days / 30.4), 'month');
  return rtf.format(-Math.round(days / 365), 'year');
}

function storeState(store: StoreOverview): { label: string; tone: BadgeTone } {
  if (store.status === 'SUSPENDED') return { label: 'Suspended', tone: 'red' };
  if (store.passwordProtected) return { label: 'Password protected', tone: 'yellow' };
  return { label: 'Live', tone: 'green' };
}

function planLabel(plan: NonNullable<StoreOverview['plan']>): string {
  return plan.status === 'TRIALING' ? `${plan.name} · trial` : plan.name;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-3 first:pl-0 last:pr-0">
      <dt className="truncate text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 truncate text-[15px] font-semibold text-slate-900 tabular-nums">
        {value}
      </dd>
    </div>
  );
}

function StoreCard({ store }: { store: StoreOverview }) {
  const state = storeState(store);
  const address = storefrontUrlFor(store.subdomain);
  const template = findThemeTemplate(store.theme.settings.template);
  const { metrics, team } = store;
  const cells = [
    metrics.sales30d !== null
      ? { label: 'Sales, 30 days', value: formatMoney(metrics.sales30d, store.currency) }
      : null,
    metrics.orders !== null
      ? { label: 'Orders', value: metrics.orders.toLocaleString('en-US') }
      : null,
    metrics.customers !== null
      ? { label: 'Customers', value: metrics.customers.toLocaleString('en-US') }
      : null,
    metrics.products !== null
      ? { label: 'Products', value: metrics.products.toLocaleString('en-US') }
      : null,
  ].filter((cell) => cell !== null);

  return (
    <article className="group/card relative flex h-full flex-col rounded-2xl border border-slate-200 bg-slate-50 p-1 shadow-card transition-shadow hover:shadow-raised">
      <div className="px-4 pt-4">
        <StorePreview store={store} address={address} />
      </div>
      <div className="flex flex-1 flex-col rounded-xl border border-slate-200/80 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-slate-900">
              {/* The whole card opens the store; the storefront link sits above this overlay. */}
              <Link
                href={`/s/${store.id}`}
                className="after:absolute after:inset-0 after:rounded-2xl"
              >
                {store.name}
              </Link>
            </h2>
            <a
              href={address}
              target="_blank"
              rel="noreferrer"
              className="relative z-10 mt-0.5 inline-flex max-w-full items-center gap-1 text-[13px] text-slate-500 hover:text-slate-900 hover:underline"
            >
              <span className="truncate">{address.replace(/^https?:\/\//, '')}</span>
              <Icon name="external" className="h-3 w-3 shrink-0" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </div>
          <Badge tone={state.tone}>{state.label}</Badge>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
          <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
            {ROLE_LABELS[store.role]}
          </span>
          {store.plan ? (
            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
              {planLabel(store.plan)}
            </span>
          ) : null}
          {template ? (
            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
              {template.name} template
            </span>
          ) : null}
          <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
            {store.currency}
          </span>
        </div>

        {cells.length > 0 ? (
          <dl
            className="mt-4 grid divide-x divide-slate-100 border-y border-slate-100 py-3"
            style={{ gridTemplateColumns: `1.35fr repeat(${cells.length - 1}, minmax(0, 1fr))` }}
          >
            {cells.map((cell) => (
              <Metric key={cell.label} label={cell.label} value={cell.value} />
            ))}
          </dl>
        ) : null}

        <div className="mt-auto flex items-end justify-between gap-3 pt-3.5">
          <div className="min-w-0 text-xs text-slate-500">
            <p className="flex items-center gap-1.5">
              <Icon name="calendar" className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                Created{' '}
                <time dateTime={store.createdAt} className="font-medium text-slate-700">
                  {formatDate(store.createdAt, store.timezone)}
                </time>{' '}
                · {timeAgo(store.createdAt)}
              </span>
            </p>
            {metrics.lastOrderAt ? (
              <p className="mt-1 flex items-center gap-1.5">
                <Icon name="clock" className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Last order {timeAgo(metrics.lastOrderAt)}</span>
              </p>
            ) : null}
          </div>
          {team ? (
            <div className="flex shrink-0 items-center gap-2">
              <AvatarStack
                size="sm"
                names={team.members.slice(0, 3).map((m) => m.name)}
                extra={Math.max(0, team.count - 3)}
              />
              <span className="text-xs whitespace-nowrap text-slate-500">
                {team.count} {team.count === 1 ? 'person' : 'people'}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default async function StoresPage() {
  const [user, stores] = await Promise.all([
    getCurrentUser(),
    api<StoreOverview[]>('/admin/stores/overview'),
  ]);
  if (stores.length === 0 && user.platformRole !== 'SUPER_ADMIN') redirect('/onboarding');

  const sum = (pick: (s: StoreOverview) => number | null) => {
    const values = stores.map(pick).filter((v) => v !== null);
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) : null;
  };
  const live = stores.filter((s) => s.status === 'ACTIVE' && !s.passwordProtected).length;
  const orders = sum((s) => s.metrics.orders);
  const customers = sum((s) => s.metrics.customers);

  return (
    <div className="min-h-screen bg-canvas">
      <TopBar user={user} />
      <main className="mx-auto max-w-[1360px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <PageHeader
          title="Your stores"
          description={`Signed in as ${user.name}`}
          actions={
            <ButtonLink href="/onboarding" icon="plus">
              Create store
            </ButtonLink>
          }
        />

        {stores.length > 0 ? (
          <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
            <KpiCard
              icon="onlineStore"
              label="Stores"
              value={stores.length}
              footer="You are a member of these"
            />
            <KpiCard icon="globe" label="Live now" value={live} footer="Open to shoppers" />
            {orders !== null ? (
              <KpiCard
                icon="orders"
                label="Paid orders"
                value={orders.toLocaleString('en-US')}
                footer="All time, all stores"
              />
            ) : null}
            {customers !== null ? (
              <KpiCard
                icon="customers"
                label="Customers"
                value={customers.toLocaleString('en-US')}
                footer="All time, all stores"
              />
            ) : null}
          </div>
        ) : null}

        <StoresBrowser
          stores={stores.map((store) => ({
            id: store.id,
            name: store.name,
            subdomain: store.subdomain,
            createdAt: store.createdAt,
            card: <StoreCard store={store} />,
          }))}
          trailing={
            <Link
              href="/onboarding"
              className="flex h-full min-h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 p-6 text-center transition-colors hover:border-slate-500 hover:bg-white"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white">
                <Icon name="plus" className="h-5 w-5" strokeWidth={2} />
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-900">
                  Add another store
                </span>
                <span className="mt-0.5 block text-[13px] text-slate-500">
                  A new brand, market or test shop
                </span>
              </span>
            </Link>
          }
        />
      </main>
    </div>
  );
}
