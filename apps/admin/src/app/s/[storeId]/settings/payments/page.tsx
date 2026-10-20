import {
  formatMoney,
  PAYOUT_COUNTRIES,
  type PaymentAccountStatus,
  type PaymentsOverview,
} from '@repo/contracts';
import Link from 'next/link';
import { ActionForm, SelectField, SubmitButton } from '@/components/form';
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
import { SmallAction } from '../small-action';
import { connectPaymentsAction, openPaymentsDashboardAction } from './actions';

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
      {returned && account?.status === 'ACTIVE' ? (
        <Alert tone="success">Payments are set up. Your store can now accept orders.</Alert>
      ) : null}

      <Card
        title="Payouts account"
        description={`Shoppers pay by card on a secure hosted page. Sales are paid out to your bank account minus a ${fee} platform fee on your plan.`}
        actions={
          account ? (
            <Badge tone={STATUS[account.status].tone}>{STATUS[account.status].label}</Badge>
          ) : (
            <Badge>Not set up</Badge>
          )
        }
      >
        {connectable ? (
          canManage ? (
            <ActionForm action={connectPaymentsAction.bind(null, storeId)}>
              {account?.status === 'DISCONNECTED' ? (
                <Alert tone="warning">
                  Your payouts account was disconnected. Connect a new one to accept payments again.
                </Alert>
              ) : null}
              <SelectField
                name="country"
                label="Country of your business"
                defaultValue="US"
                hint="This cannot be changed later."
                options={PAYOUT_COUNTRIES.map((code) => ({
                  value: code,
                  label: countryName.of(code) ?? code,
                }))}
              />
              <SubmitButton>Set up payments</SubmitButton>
            </ActionForm>
          ) : (
            <p className="text-sm text-slate-500">Only the store owner can set up payments.</p>
          )
        ) : account ? (
          <div className="space-y-4">
            {account.status !== 'ACTIVE' ? (
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
                { term: 'Provider', detail: payments.sandbox ? 'Sandbox' : 'Stripe' },
                { term: 'Account', detail: <code>{account.accountId}</code> },
                {
                  term: 'Country',
                  detail: account.country
                    ? (countryName.of(account.country) ?? account.country)
                    : '—',
                },
                { term: 'Card payments', detail: account.chargesEnabled ? 'Enabled' : 'Disabled' },
                { term: 'Payouts', detail: account.payoutsEnabled ? 'Enabled' : 'Paused' },
              ]}
            />
            {canManage ? (
              <div className="flex flex-wrap items-center gap-4">
                {account.status !== 'ACTIVE' ? (
                  <Link
                    href={`/s/${storeId}/settings/payments/onboarding`}
                    prefetch={false}
                    className={buttonClass()}
                  >
                    Continue setup
                  </Link>
                ) : null}
                {account.detailsSubmitted ? (
                  <SmallAction
                    action={openPaymentsDashboardAction.bind(null, storeId)}
                    label="Open payouts dashboard"
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </Card>

      <Card title={`Last ${summary.days} days`} description={`${summary.paidOrders} paid orders`}>
        <dl className="grid gap-4 sm:grid-cols-4">
          {(
            [
              ['Gross sales', summary.gross],
              ['Platform fees', -summary.platformFees],
              ['Refunds', -summary.refunds],
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

      {account ? (
        <Card title="Payouts">
          {payments.payouts === null ? (
            <p className="text-sm text-slate-500">
              {payments.sandbox
                ? 'The sandbox does not simulate payouts.'
                : 'Payouts are not available right now. Try again later.'}
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
