import { type AdminCustomerDetail, formatMoney } from '@repo/contracts';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Badge,
  Card,
  DescriptionList,
  formatDateTime,
  PageHeader,
  Table,
  Td,
} from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { getStore } from '@/lib/session';
import { ConfirmButton } from '../../confirm-button';
import { FinancialBadge, FulfillmentBadge } from '../../orders/badges';
import { redactCustomerAction } from '../actions';

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ storeId: string; customerId: string }>;
}) {
  const { storeId, customerId } = await params;
  const store = await getStore(storeId);
  let customer: AdminCustomerDetail;
  try {
    customer = await api<AdminCustomerDetail>(`/admin/stores/${storeId}/customers/${customerId}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const canSeeOrders = store.permissions.includes('orders:read');
  const canManage = store.permissions.includes('customers:write');

  return (
    <>
      <PageHeader
        title={customer.name ?? customer.email}
        back={{ href: `/s/${storeId}/customers`, label: 'Customers' }}
      />
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card title="Orders">
          {customer.orders.length === 0 ? (
            <p className="text-sm text-slate-500">No orders.</p>
          ) : (
            <Table head={['Order', 'Date', 'Payment', 'Fulfillment', 'Total']}>
              {customer.orders.map((o) => (
                <tr key={o.id}>
                  <Td>
                    {canSeeOrders ? (
                      <Link
                        href={`/s/${storeId}/orders/${o.id}`}
                        className="font-medium hover:underline"
                      >
                        #{o.number}
                      </Link>
                    ) : (
                      `#${o.number}`
                    )}
                  </Td>
                  <Td>{formatDateTime(o.createdAt)}</Td>
                  <Td>
                    <FinancialBadge status={o.financialStatus} />
                  </Td>
                  <Td>
                    <FulfillmentBadge status={o.fulfillmentStatus} />
                  </Td>
                  <Td>{formatMoney(o.total, o.currency)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
        <Card title="Details">
          <DescriptionList
            items={[
              { term: 'Email', detail: customer.email },
              {
                term: 'Account',
                detail: customer.hasAccount ? (
                  <Badge tone="green">Registered</Badge>
                ) : (
                  <Badge>Guest</Badge>
                ),
              },
              {
                term: 'Marketing',
                detail: customer.acceptsMarketing ? 'Subscribed' : 'Not subscribed',
              },
              { term: 'Orders', detail: customer.ordersCount },
              { term: 'Total spent', detail: formatMoney(customer.totalSpent, store.currency) },
              { term: 'Since', detail: formatDateTime(customer.createdAt) },
            ]}
          />
        </Card>
        {canManage ? (
          <Card title="Privacy" description="Data-subject requests (access / erasure).">
            <div className="space-y-3">
              <a
                href={`/s/${storeId}/customers/${customerId}/export`}
                className="block text-sm font-medium text-indigo-600 hover:underline"
              >
                Download customer data (JSON)
              </a>
              <ConfirmButton
                action={redactCustomerAction.bind(null, storeId, customerId)}
                label="Redact personal data"
                confirmLabel="Yes, redact permanently"
              />
              <p className="text-xs text-slate-500">
                Removes name, email, password and addresses. Orders are kept (anonymised) for
                accounting.
              </p>
            </div>
          </Card>
        ) : null}
      </div>
    </>
  );
}
