import { type BillingOverview, formatMoney, type Plan } from '@repo/contracts';
import { Alert, Badge, Card, formatDateTime, Table, Td } from '@/components/ui';
import { api } from '@/lib/api';
import { getStore } from '@/lib/session';
import { SmallAction } from '../small-action';
import { changePlanAction } from './actions';

function Meter({ label, used, max }: { label: string; used: number; max: number | null }) {
  const pct = max === null ? 0 : Math.min(100, Math.round((used / Math.max(1, max)) * 100));
  const tone = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-indigo-600';
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium">
          {used} / {max === null ? 'Unlimited' : max}
        </span>
      </div>
      {max !== null ? (
        <div
          className="mt-1 h-2 rounded-full bg-slate-100"
          role="progressbar"
          aria-label={`${label} usage`}
          aria-valuenow={used}
          aria-valuemin={0}
          aria-valuemax={max}
        >
          <div className={`h-2 rounded-full ${tone}`} style={{ width: `${pct}%` }} />
        </div>
      ) : null}
    </div>
  );
}

const limitText = (n: number | null, noun: string) =>
  n === null ? `Unlimited ${noun}` : `${n} ${noun}`;

export default async function BillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<{ upgraded?: string }>;
}) {
  const { storeId } = await params;
  const { upgraded } = await searchParams;
  const [store, billing] = await Promise.all([
    getStore(storeId),
    api<BillingOverview>(`/admin/stores/${storeId}/billing`),
  ]);
  const canManage = store.permissions.includes('billing:manage');
  const usd = (n: number) => formatMoney(n, 'USD');
  const fee = (p: Plan) => `${(p.transactionFeeBps / 100).toFixed(1)}% platform fee`;

  return (
    <div className="space-y-6">
      {upgraded ? (
        <Alert tone="success">
          Thanks! Your plan change is being confirmed by the payment provider.
        </Alert>
      ) : null}
      <Card
        title={`${billing.plan.name} plan`}
        description={
          billing.status === 'TRIALING' && billing.trialEndsAt
            ? `Free trial until ${formatDateTime(billing.trialEndsAt)}`
            : `${billing.plan.priceMonthly === 0 ? 'Free' : `${usd(billing.plan.priceMonthly)}/month`} · renews ${formatDateTime(billing.currentPeriodEnd)}`
        }
        actions={
          <Badge
            tone={
              billing.status === 'ACTIVE' ? 'green' : billing.status === 'TRIALING' ? 'blue' : 'red'
            }
          >
            {billing.status.toLowerCase()}
          </Badge>
        }
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Meter label="Products" used={billing.usage.products} max={billing.plan.maxProducts} />
          <Meter label="Staff accounts" used={billing.usage.staff} max={billing.plan.maxStaff} />
          <Meter
            label="Orders this month"
            used={billing.usage.ordersThisMonth}
            max={billing.plan.maxOrdersPerMonth}
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {billing.plans.map((p) => {
          const current = p.id === billing.plan.id;
          return (
            <section
              key={p.id}
              className={`rounded-lg border bg-white p-5 shadow-sm ${current ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-200'}`}
            >
              <h3 className="text-lg font-semibold">{p.name}</h3>
              <p className="mt-1 text-2xl font-bold">
                {p.priceMonthly === 0 ? 'Free' : usd(p.priceMonthly)}
                {p.priceMonthly > 0 ? (
                  <span className="text-sm font-normal text-slate-500">/month</span>
                ) : null}
              </p>
              <ul className="mt-3 space-y-1 text-sm text-slate-600">
                <li>{limitText(p.maxProducts, 'products')}</li>
                <li>{limitText(p.maxStaff, 'staff accounts')}</li>
                <li>{limitText(p.maxOrdersPerMonth, 'orders / month')}</li>
                <li>{fee(p)}</li>
              </ul>
              <div className="mt-4">
                {current ? (
                  <Badge tone="indigo">Current plan</Badge>
                ) : canManage ? (
                  <SmallAction
                    action={changePlanAction.bind(null, storeId, p.id)}
                    label={`Switch to ${p.name}`}
                  />
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
      {!canManage ? (
        <p className="text-sm text-slate-500">Only the store owner can change the plan.</p>
      ) : null}

      <Card title="Invoices">
        {billing.invoices.length === 0 ? (
          <p className="text-sm text-slate-500">No invoices yet.</p>
        ) : (
          <Table head={['Date', 'Plan', 'Period', 'Amount', 'Status']}>
            {billing.invoices.map((i) => (
              <tr key={i.id}>
                <Td>{formatDateTime(i.createdAt)}</Td>
                <Td>{i.planName}</Td>
                <Td>
                  {new Date(i.periodStart).toLocaleDateString()} –{' '}
                  {new Date(i.periodEnd).toLocaleDateString()}
                </Td>
                <Td>{formatMoney(i.amount, i.currency)}</Td>
                <Td>
                  <Badge tone={i.status === 'PAID' ? 'green' : 'gray'}>
                    {i.status.toLowerCase()}
                  </Badge>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
