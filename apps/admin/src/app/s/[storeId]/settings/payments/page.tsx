import {
  formatMoney,
  type PaymentAccount,
  type PaymentAccountStatus,
  type PaymentsOverview,
} from '@repo/contracts';
import Link from 'next/link';
import { DisputeSummary } from '@/components/disputes';
import {
  Alert,
  Badge,
  type BadgeTone,
  buttonClass,
  Card,
  DescriptionList,
  Table,
  Td,
} from '@/components/ui';
import { api } from '@/lib/api';
import { getStore } from '@/lib/session';
import { ConfirmButton } from '../../confirm-button';
import { SmallAction } from '../small-action';
import { disconnectPaymentsAction, openPaymentsDashboardAction } from './actions';
import { ConnectGateways } from './connect-gateways';

export const metadata = { title: 'Payments · Merchant Admin' };

const STATUS: Record<PaymentAccountStatus, { label: string; tone: BadgeTone }> = {
  ONBOARDING: { label: 'Setup incomplete', tone: 'yellow' },
  ACTIVE: { label: 'Active', tone: 'green' },
  RESTRICTED: { label: 'Action required', tone: 'red' },
  DISCONNECTED: { label: 'Disconnected', tone: 'gray' },
};

const countryName = new Intl.DisplayNames(['en'], { type: 'region' });

/** Provider requirement codes like "individual.id_number" in plain words. */
function requirementLabel(code: string): string {
  return (code.split('.').pop() ?? code).replaceAll('_', ' ');
}

function statusBadge(account: PaymentAccount) {
  // Submitted with nothing outstanding: the provider is reviewing it.
  if (account.status === 'ONBOARDING' && account.detailsSubmitted) {
    return <Badge tone="blue">In review</Badge>;
  }
  return <Badge tone={STATUS[account.status].tone}>{STATUS[account.status].label}</Badge>;
}

export default async function PaymentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<{ onboarding?: string; 'sandbox-dashboard'?: string }>;
}) {
  const { storeId } = await params;
  const query = await searchParams;
  const base = `/admin/stores/${storeId}/payments`;
  const store = await getStore(storeId);
  const canManage = store.permissions.includes('billing:manage');
  // Back from the provider's onboarding: re-read the account instead of waiting for the webhook.
  const returned = query.onboarding === 'returned';
  const payments = returned
    ? await api<PaymentsOverview>(`${base}/account/refresh`, { method: 'POST' }).catch(() =>
        api<PaymentsOverview>(base),
      )
    : await api<PaymentsOverview>(base);
  const { account, summary } = payments;
  const money = (n: number) => formatMoney(n, summary.currency);
  const fee = `${(payments.transactionFeeBps / 100).toFixed(1)}%`;
  const connectable = !account || account.status === 'DISCONNECTED';
  const hosted =
    payments.gateways.find((g) => g.provider === account?.provider)?.onboarding !== 'form';

  return (
    <div className="space-y-6">
      {payments.sandbox ? (
        <Alert tone="info">
          Sandbox mode: onboarding and payments are simulated and no money moves.
        </Alert>
      ) : null}
      {query['sandbox-dashboard'] ? (
        <Alert tone="info">
          In production this opens your Stripe Express dashboard: payouts, bank account and tax
          forms.
        </Alert>
      ) : null}
      {(returned || query.onboarding === 'submitted') && account?.status === 'ACTIVE' ? (
        <Alert tone="success">Payments are set up. Your store can now accept orders.</Alert>
      ) : null}
      {query.onboarding === 'submitted' && account && account.status !== 'ACTIVE' ? (
        <Alert tone="info">
          Thanks! {account.label} is verifying your details. You&apos;ll be able to accept orders as
          soon as it activates your account.
        </Alert>
      ) : null}
      {account && !account.gatewayEnabled ? (
        <Alert tone="error">
          {account.label} is no longer offered on this platform. Disconnect it and set up another
          provider to accept payments.
        </Alert>
      ) : null}

      <Card
        title="Payouts account"
        description={`Shoppers pay on a secure page hosted by your payment provider. Sales are paid out to your bank account minus a ${fee} platform fee on your plan.`}
        actions={account ? statusBadge(account) : <Badge>Not set up</Badge>}
      >
        {connectable ? (
          canManage ? (
            <div className="space-y-4">
              {account?.status === 'DISCONNECTED' ? (
                <Alert tone="warning">
                  Your payouts account is disconnected. Set up a provider to accept payments again.
                </Alert>
              ) : null}
              <ConnectGateways
                storeId={storeId}
                gateways={payments.gateways}
                currency={summary.currency}
              />
            </div>
          ) : (
            <p className="text-sm text-slate-500">Only the store owner can set up payments.</p>
          )
        ) : account ? (
          <div className="space-y-4">
            {account.status !== 'ACTIVE' &&
            !(account.status === 'ONBOARDING' && account.detailsSubmitted) ? (
              <Alert tone="warning">
                {account.status === 'ONBOARDING'
                  ? 'Finish setting up payments to start accepting orders.'
                  : 'Your payment provider needs more information before you can accept payments.'}
                {account.requirementsDue.length > 0 ? (
                  <ul className="mt-2 list-disc pl-5">
                    {account.requirementsDue.map((r) => (
                      <li key={r}>{requirementLabel(r)}</li>
                    ))}
                  </ul>
                ) : null}
              </Alert>
            ) : null}
            <DescriptionList
              items={[
                { term: 'Provider', detail: account.label },
                { term: 'Account', detail: <code>{account.accountId}</code> },
                {
                  term: 'Country',
                  detail: account.country
                    ? (countryName.of(account.country) ?? account.country)
                    : '—',
                },
                { term: 'Payments', detail: account.chargesEnabled ? 'Enabled' : 'Disabled' },
                { term: 'Payouts', detail: account.payoutsEnabled ? 'Enabled' : 'Paused' },
              ]}
            />
            {canManage ? (
              <div className="flex flex-wrap items-center gap-4">
                {account.status !== 'ACTIVE' && hosted ? (
                  <Link
                    href={`/s/${storeId}/settings/payments/onboarding`}
                    prefetch={false}
                    className={buttonClass()}
                  >
                    Continue setup
                  </Link>
                ) : null}
                {account.detailsSubmitted && account.hasDashboard ? (
                  <SmallAction
                    action={openPaymentsDashboardAction.bind(null, storeId)}
                    label="Open payouts dashboard"
                  />
                ) : null}
                <ConfirmButton
                  action={disconnectPaymentsAction.bind(null, storeId)}
                  label="Disconnect"
                  confirmLabel={`Stop taking payments with ${account.label}`}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </Card>

      <Card title={`Last ${summary.days} days`} description={`${summary.paidOrders} paid orders`}>
        <dl className="grid gap-4 sm:grid-cols-5">
          {(
            [
              ['Gross sales', summary.gross],
              ['Platform fees', -summary.platformFees],
              ['Refunds', -summary.refunds],
              ['Chargebacks', -summary.chargebacks],
              ['Net', summary.net],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="rounded-md bg-slate-50 p-4">
              <dt className="text-sm text-slate-500">{label}</dt>
              <dd className="mt-1 text-xl font-semibold text-slate-900">{money(value)}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-slate-500">
          Net is before the payment provider&apos;s processing fees, which the platform covers.
        </p>
      </Card>

      <Card
        title="Chargebacks"
        description={
          payments.openDisputes > 0
            ? `${payments.openDisputes} open: respond in your payment provider's dashboard before the deadline.`
            : "Disputes raised by customers' banks appear here."
        }
      >
        {payments.disputes.length === 0 ? (
          <p className="text-sm text-slate-500">No chargebacks.</p>
        ) : (
          <Table head={['Order', 'Opened', 'Details']}>
            {payments.disputes.map((d) => (
              <tr key={d.id}>
                <Td>
                  <Link
                    className="font-medium text-indigo-600 hover:underline"
                    href={`/s/${storeId}/orders/${d.orderId}`}
                  >
                    #{d.orderNumber}
                  </Link>
                </Td>
                <Td>{new Date(d.createdAt).toLocaleDateString()}</Td>
                <Td>
                  <DisputeSummary dispute={d} />
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {account ? (
        <Card title="Payouts">
          {payments.payouts === null ? (
            <p className="text-sm text-slate-500">
              {payments.sandbox
                ? 'The sandbox does not simulate payouts.'
                : account.hasDashboard
                  ? 'Payouts are not available right now. Try again later.'
                  : `${account.label} pays out to your bank account automatically and emails you each settlement.`}
            </p>
          ) : payments.payouts.length === 0 ? (
            <p className="text-sm text-slate-500">No payouts yet.</p>
          ) : (
            <Table head={['Arrival', 'Amount', 'Status']}>
              {payments.payouts.map((p) => (
                <tr key={p.id}>
                  <Td>{new Date(p.arrivalDate).toLocaleDateString()}</Td>
                  <Td>{formatMoney(p.amount, p.currency)}</Td>
                  <Td>
                    <Badge
                      tone={p.status === 'paid' ? 'green' : p.status === 'failed' ? 'red' : 'blue'}
                    >
                      {p.status.replaceAll('_', ' ')}
                    </Badge>
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      ) : null}
    </div>
  );
}
