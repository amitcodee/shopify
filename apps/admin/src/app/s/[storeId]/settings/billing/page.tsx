import { type BillingOverview, formatMoney, type Plan } from '@repo/contracts';
import { Alert, Badge, Card, formatDateTime, Table, Td } from '@/components/ui';
import { api } from '@/lib/api';
import { getStore } from '@/lib/session';
import { SmallAction } from '../small-action';
import { cancelSubscriptionAction } from './actions';
import { SubscribeButton } from './subscribe-button';

const DAY_MS = 24 * 60 * 60 * 1000;

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

const money = (amount: number, currency: string) => formatMoney(amount, currency);
const limitText = (n: number | null, noun: string) =>
  n === null ? `Unlimited ${noun}` : `Up to ${n} ${noun}`;
const daysLeft = (iso: string) => Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / DAY_MS));

function statusBadge(billing: BillingOverview) {
  if (billing.locked) return <Badge tone="red">Paused</Badge>;
  switch (billing.status) {
    case 'TRIALING':
      return <Badge tone="blue">Free trial</Badge>;
    case 'ACTIVE':
      return billing.cancelAtPeriodEnd ? (
        <Badge tone="yellow">Cancels at period end</Badge>
      ) : (
        <Badge tone="green">Active</Badge>
      );
    case 'PAST_DUE':
      return <Badge tone="yellow">Payment failed</Badge>;
    default:
      return <Badge tone="gray">No subscription</Badge>;
  }
}

/** One sentence about where the merchant stands and what happens next. */
function statusText(billing: BillingOverview): string {
  const plan = billing.plan;
  const first =
    billing.introAvailable && plan.introPrice !== null ? plan.introPrice : plan.priceMonthly;
  if (billing.locked) {
    return 'Your storefront is offline because there is no active subscription. Your data is safe; subscribe to bring the store back online right away.';
  }
  switch (billing.status) {
    case 'TRIALING': {
      if (!billing.trialEndsAt) return 'Free trial.';
      const days = daysLeft(billing.trialEndsAt);
      const when = formatDateTime(billing.trialEndsAt);
      return billing.action === 'subscribe'
        ? `${days} day${days === 1 ? '' : 's'} left in your free trial (ends ${when}). Subscribe any time — you are only charged when the trial ends.`
        : `You are subscribed. Your first charge of ${money(first, plan.currency)} happens when the trial ends on ${when}.`;
    }
    case 'ACTIVE':
      if (billing.action === 'authorize') {
        return `Your introductory months end on ${formatDateTime(billing.currentPeriodEnd)}. Authorise the regular payment of ${money(plan.priceMonthly, plan.currency)}/month to keep your store online.`;
      }
      return billing.cancelAtPeriodEnd
        ? `Your subscription ends on ${formatDateTime(billing.currentPeriodEnd)}. Subscribe again to keep the store online after that.`
        : `${money(billing.onIntroPrice && plan.introPrice !== null ? plan.introPrice : plan.priceMonthly, plan.currency)}/month · next charge on ${formatDateTime(billing.currentPeriodEnd)}.`;
    case 'PAST_DUE':
      return `Your last payment failed and is being retried. Your store keeps working until ${formatDateTime(billing.graceEndsAt ?? billing.currentPeriodEnd)}; update your payment method to avoid a pause.`;
    case 'CANCELLED':
      return `Your subscription was cancelled. The store stays online until ${formatDateTime(billing.currentPeriodEnd)}.`;
    default:
      return 'There is no active subscription.';
  }
}

function PlanPrice({ plan, intro }: { plan: Plan; intro: boolean }) {
  if (intro && plan.introPrice !== null) {
    return (
      <div className="mt-3">
        <p className="text-3xl font-bold tracking-tight">
          {money(plan.introPrice, plan.currency)}
          <span className="text-sm font-normal text-slate-500">/month</span>
        </p>
        <p className="mt-1 text-sm text-slate-600">
          for your first {plan.introCycles} months, then{' '}
          <span className="font-medium text-slate-900">
            {money(plan.priceMonthly, plan.currency)}/month
          </span>
        </p>
      </div>
    );
  }
  return (
    <p className="mt-3 text-3xl font-bold tracking-tight">
      {money(plan.priceMonthly, plan.currency)}
      <span className="text-sm font-normal text-slate-500">/month</span>
    </p>
  );
}

export default async function BillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<{ upgraded?: string; locked?: string }>;
}) {
  const { storeId } = await params;
  const { upgraded, locked } = await searchParams;
  const [store, billing] = await Promise.all([
    getStore(storeId),
    api<BillingOverview>(`/admin/stores/${storeId}/billing`),
  ]);
  const canManage = store.permissions.includes('billing:manage');
  const subscribed =
    billing.provider !== 'none' &&
    billing.action !== 'subscribe' &&
    !['EXPIRED', 'CANCELLED'].includes(billing.status);

  return (
    <div className="space-y-6">
      {upgraded ? (
        <Alert tone="success">
          Thanks! Your subscription is being confirmed by the payment provider.
        </Alert>
      ) : null}
      {locked && billing.locked ? (
        <Alert tone="error">
          Choose a plan to continue. Everything else in the admin opens again as soon as you
          subscribe.
        </Alert>
      ) : null}

      <Card
        title={`${billing.plan.name} plan`}
        description={statusText(billing)}
        actions={statusBadge(billing)}
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
        {canManage && billing.action === 'update_payment' ? (
          <div className="mt-5">
            <SubscribeButton
              storeId={storeId}
              planId={billing.plan.id}
              label="Update payment method"
            />
          </div>
        ) : null}
        {canManage && billing.action === 'authorize' ? (
          <div className="mt-5">
            <SubscribeButton
              storeId={storeId}
              planId={billing.plan.id}
              label={`Authorise ${money(billing.plan.priceMonthly, billing.plan.currency)}/month`}
            />
          </div>
        ) : null}
      </Card>

      <div
        className={`grid grid-cols-1 gap-4 ${billing.plans.length > 1 ? 'md:grid-cols-2 xl:grid-cols-3' : 'max-w-xl'}`}
      >
        {billing.plans.map((p) => {
          const current = p.id === billing.plan.id;
          const intro = billing.introAvailable && p.introPrice !== null && p.introCycles > 0;
          const showSubscribe = canManage && (!current || !subscribed);
          return (
            <section
              key={p.id}
              className={`rounded-xl border bg-white p-6 shadow-card ${current ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-semibold">{p.name}</h3>
                {intro ? <Badge tone="indigo">Launch offer</Badge> : null}
              </div>
              <PlanPrice plan={p} intro={intro} />
              <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
                {p.trialDays > 0 && billing.status === 'TRIALING' ? (
                  <li>✓ {p.trialDays}-day free trial — pay nothing today</li>
                ) : null}
                <li>✓ {limitText(p.maxProducts, 'products')}</li>
                <li>✓ {limitText(p.maxStaff, 'staff accounts')}</li>
                <li>✓ {limitText(p.maxOrdersPerMonth, 'orders a month')}</li>
                <li>
                  ✓{' '}
                  {p.transactionFeeBps === 0
                    ? '0% platform fee on your sales'
                    : `${(p.transactionFeeBps / 100).toFixed(1)}% platform fee on sales`}
                </li>
                <li>
                  ✓ Your own gateway (Razorpay, PayU, Cashfree, PhonePe…) and cash on delivery
                </li>
                <li>✓ Every template, custom domain and app included</li>
                <li>✓ Pay by UPI AutoPay or card · price includes GST</li>
              </ul>
              <div className="mt-5">
                {showSubscribe ? (
                  <SubscribeButton
                    storeId={storeId}
                    planId={p.id}
                    label={
                      current
                        ? billing.status === 'TRIALING'
                          ? 'Subscribe now'
                          : 'Subscribe'
                        : `Switch to ${p.name}`
                    }
                  />
                ) : current ? (
                  <Badge tone="indigo">Your plan</Badge>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
      {!canManage ? (
        <p className="text-sm text-slate-500">Only the store owner can manage billing.</p>
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
                <Td>{money(i.amount, i.currency)}</Td>
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

      {canManage && subscribed && !billing.cancelAtPeriodEnd ? (
        <Card
          title="Cancel subscription"
          description="Your store stays online until the end of the period you paid for. No further charges are made."
        >
          <SmallAction
            action={cancelSubscriptionAction.bind(null, storeId)}
            label="Cancel subscription"
            danger
          />
        </Card>
      ) : null}
    </div>
  );
}
